#include "DependencyGraph.h"
#include <algorithm>
#include <functional>

void DependencyGraph::addNode(const std::string& name, int line) {
    allNodes_.insert(name);
    if (dependencies_.find(name) == dependencies_.end()) {
        dependencies_[name] = {};
    }
    if (dependents_.find(name) == dependents_.end()) {
        dependents_[name] = {};
    }
    if (line >= 0) {
        declLine_[name] = line;
    }
}

void DependencyGraph::addDependency(const std::string& from, const std::string& on) {
    addNode(from);
    addNode(on);
    dependencies_[from].insert(on);
    dependents_[on].insert(from);
}

std::set<std::string> DependencyGraph::dependenciesOf(const std::string& name) const {
    auto it = dependencies_.find(name);
    if (it == dependencies_.end()) return {};
    return it->second;
}

std::set<std::string> DependencyGraph::dependentsOf(const std::string& name) const {
    auto it = dependents_.find(name);
    if (it == dependents_.end()) return {};
    return it->second;
}

std::set<std::string> DependencyGraph::transitiveDependenciesOf(const std::string& name) const {
    std::set<std::string> visited;
    std::vector<std::string> stack;
    stack.push_back(name);

    while (!stack.empty()) {
        std::string current = stack.back();
        stack.pop_back();
        auto it = dependencies_.find(current);
        if (it == dependencies_.end()) continue;
        for (const auto& dep : it->second) {
            if (visited.find(dep) == visited.end()) {
                visited.insert(dep);
                stack.push_back(dep);
            }
        }
    }

    return visited; // does not include `name` itself
}

int DependencyGraph::lineOf(const std::string& name) const {
    auto it = declLine_.find(name);
    if (it == declLine_.end()) return -1;
    return it->second;
}

// Standard 3-color DFS cycle detection (White = unvisited, Gray = on the
// current recursion path, Black = fully processed). A back edge to a Gray
// node is a cycle. Nodes are iterated in sorted order (allNodes_) so that
// which cycle gets reported first is deterministic, and neighbors within
// each node's dependency set are already sorted (std::set), so the
// reconstructed cycle path is deterministic too.
namespace {
enum class Color { White, Gray, Black };
}

bool DependencyGraph::hasCycle(std::vector<std::string>* cyclePathOut) const {
    std::unordered_map<std::string, Color> color;
    for (const auto& n : allNodes_) color[n] = Color::White;

    std::vector<std::string> path;

    // Returns true if a cycle was found starting from `node`; on success,
    // `path` holds the full cycle (first node repeated at the end).
    std::function<bool(const std::string&)> dfs = [&](const std::string& node) -> bool {
        color[node] = Color::Gray;
        path.push_back(node);

        auto it = dependencies_.find(node);
        if (it != dependencies_.end()) {
            for (const auto& next : it->second) {
                if (color[next] == Color::Gray) {
                    // Found the back edge. Trim `path` down to just the
                    // cycle itself: from next's first occurrence to here.
                    if (cyclePathOut) {
                        auto pos = std::find(path.begin(), path.end(), next);
                        cyclePathOut->assign(pos, path.end());
                        cyclePathOut->push_back(next); // close the loop visually
                    }
                    return true;
                }
                if (color[next] == Color::White) {
                    if (dfs(next)) return true;
                }
            }
        }

        path.pop_back();
        color[node] = Color::Black;
        return false;
    };

    for (const auto& n : allNodes_) {
        if (color[n] == Color::White) {
            if (dfs(n)) return true;
        }
    }
    return false;
}

bool DependencyGraph::topologicalOrder(std::vector<std::string>& outOrder) const {
    outOrder.clear();

    std::unordered_map<std::string, int> inDegree;
    for (const auto& n : allNodes_) {
        auto it = dependencies_.find(n);
        inDegree[n] = (it == dependencies_.end()) ? 0 : static_cast<int>(it->second.size());
    }

    // "Ready" nodes (in-degree 0) kept in a sorted set so that, among
    // several equally-ready nodes, we always pick the alphabetically
    // smallest one -- this is what makes the printed evaluation order
    // deterministic and identical across platforms.
    std::set<std::string> ready;
    for (const auto& n : allNodes_) {
        if (inDegree[n] == 0) ready.insert(n);
    }

    while (!ready.empty()) {
        std::string node = *ready.begin();
        ready.erase(ready.begin());
        outOrder.push_back(node);

        auto it = dependents_.find(node);
        if (it != dependents_.end()) {
            for (const auto& dependent : it->second) {
                inDegree[dependent]--;
                if (inDegree[dependent] == 0) {
                    ready.insert(dependent);
                }
            }
        }
    }

    // If not every node was emitted, some nodes never reached in-degree 0
    // -- a cycle. Fail cleanly rather than returning a partial/invalid
    // order.
    if (outOrder.size() != allNodes_.size()) {
        outOrder.clear();
        return false;
    }
    return true;
}
