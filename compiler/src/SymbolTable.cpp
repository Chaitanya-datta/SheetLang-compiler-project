#include "SymbolTable.h"

std::string semanticTypeName(SemanticType t) {
    switch (t) {
        case SemanticType::Number:  return "NUMBER";
        case SemanticType::String:  return "STRING";
        case SemanticType::Unknown: return "UNKNOWN";
    }
    return "UNKNOWN";
}

bool SymbolTable::declare(const std::string& name, SemanticType type, int line) {
    if (symbols_.find(name) != symbols_.end()) {
        return false; // already declared -- caller reports duplicate error
    }
    symbols_[name] = Symbol{name, type, line};
    return true;
}

void SymbolTable::declareOrUpdate(const std::string& name, SemanticType type, int line) {
    symbols_[name] = Symbol{name, type, line};
}

const Symbol* SymbolTable::lookup(const std::string& name) const {
    auto it = symbols_.find(name);
    if (it == symbols_.end()) return nullptr;
    return &it->second;
}

bool SymbolTable::contains(const std::string& name) const {
    return symbols_.find(name) != symbols_.end();
}

void SymbolTable::clear() {
    symbols_.clear();
}
