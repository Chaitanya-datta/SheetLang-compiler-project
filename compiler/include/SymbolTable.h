#pragma once
#include <string>
#include <unordered_map>

// SheetLang v1 has exactly two semantic value types (matching the locked
// language design: everything at runtime is i32, PRINT literals are the
// only strings). Unknown is an internal marker, never a real symbol type
// -- it means "an error already happened computing this value's type,
// don't cascade further errors from it."
enum class SemanticType {
    Number,
    String,
    Unknown
};

std::string semanticTypeName(SemanticType t);

struct Symbol {
    std::string name;
    SemanticType type;
    int line; // line of declaration (or most recent assignment, for cells)
};

// Phase 4 scoping model (deliberately flat, documented in README):
// - There is exactly ONE scope: the whole SHEET program.
// - IF/ELSE blocks do NOT introduce a new scope -- a variable declared
//   inside an IF is visible after the ENDIF, same as everywhere else.
// - This matches SheetLang's spreadsheet-like mental model (a named
//   cell/variable exists program-wide once set) and keeps Phase 4 simple
//   enough to extend later without redesigning it.
class SymbolTable {
public:
    // For LET declarations: fails (returns false) if `name` is already
    // declared -- LET is single-assignment by design.
    bool declare(const std::string& name, SemanticType type, int line);

    // For CELL assignments: always succeeds, overwriting any previous
    // entry. Cells behave like spreadsheet cells, not LET variables --
    // reassignment is normal, not a duplicate declaration.
    void declareOrUpdate(const std::string& name, SemanticType type, int line);

    // Returns nullptr if `name` has not been declared.
    const Symbol* lookup(const std::string& name) const;

    bool contains(const std::string& name) const;

    void clear();

private:
    std::unordered_map<std::string, Symbol> symbols_;
};
