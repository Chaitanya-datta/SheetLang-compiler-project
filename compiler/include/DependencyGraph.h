#pragma once
#include <string>
#include <set>
#include <unordered_map>
#include <vector>

// Models spreadsheet-style dependencies between SheetLang symbols
// (LET variables and CELL references).
//
// EDGE DIRECTION CONVENTION (documented once, used consistently
// everywhere in this class and in DependencyAnalyzer):
//
//   An edge "X depends on Y" is stored as: X is a key in dependencies_,
//   and Y is a member of dependencies_[X]. In other words:
//
//       dependenciesOf("X") == the set of things X directly needs.
//
//   This matches the human-readable "X -> Y" printed format used by
//   `./sheetc --deps` (e.g. "B -> A" means "B depends on A"), and matches
//   the example output format in the Phase 5 spec.
//
//   The REVERSE mapping (dependents_) answers "who depends on me" and is
//   maintained alongside dependencies_ for O(1) lookups; it is exactly
//   what Kahn's-algorithm topological sorting needs to "unlock" nodes as
//   their dependencies are resolved (see topologicalOrder()).
//
// All iteration over "every node" (cycle detection start points,
// topological sort ready-queue, printed output) goes through a sorted
// std::set<std::string> of node names rather than the unordered_map's own
// iteration order, which is NOT guaranteed to be the same across
// platforms/compilers (e.g. libstdc++ on Linux vs libc++ on macOS). This
// is what makes --deps output deterministic across machines, not just
// across repeated runs on the same machine.
class DependencyGraph {
public:
    // Registers a node if it doesn't already exist. `line` is the
    // declaration line (used in dependency-error messages); passing -1
    // leaves any previously recorded line untouched.
    void addNode(const std::string& name, int line = -1);

    // Records "from depends on on" (see class-level convention above).
    // Both nodes are auto-registered via addNode() if not already present.
    void addDependency(const std::string& from, const std::string& on);

    // All node names, sorted alphabetically (deterministic iteration).
    const std::set<std::string>& nodes() const { return allNodes_; }

    // Direct dependencies / dependents of a node (empty set if the node
    // has none, or doesn't exist).
    std::set<std::string> dependenciesOf(const std::string& name) const;
    std::set<std::string> dependentsOf(const std::string& name) const;

    // All transitive dependencies of `name` (DFS through dependencies_,
    // not including `name` itself).
    std::set<std::string> transitiveDependenciesOf(const std::string& name) const;

    // Declaration line for `name`, or -1 if unknown.
    int lineOf(const std::string& name) const;

    // Detects any cycle in the graph (including a self-loop, i.e.
    // "A depends on A"). If a cycle exists and cyclePathOut is non-null,
    // it is filled with the cycle as a sequence of node names, e.g.
    // {"A", "B", "A"} for A -> B -> A, suitable for a human-readable
    // error message.
    bool hasCycle(std::vector<std::string>* cyclePathOut = nullptr) const;

    // Kahn's-algorithm topological sort: an order in which every node
    // appears only after all the things it depends on. Returns false
    // (without a meaningful outOrder) if the graph contains a cycle --
    // callers are expected to call hasCycle() first and not rely on this
    // for cycle detection, but this is still safe to call directly.
    // Ties are broken alphabetically for deterministic output.
    bool topologicalOrder(std::vector<std::string>& outOrder) const;

private:
    std::set<std::string> allNodes_;
    std::unordered_map<std::string, std::set<std::string>> dependencies_;
    std::unordered_map<std::string, std::set<std::string>> dependents_;
    std::unordered_map<std::string, int> declLine_;
};
