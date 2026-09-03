#pragma once
#include <string>

// Token numbering is owned entirely by Bison (parser.tab.h), generated from
// the %token declarations in parser.y. This function just gives
// human-readable names for --tokens output; it does not define numbering
// itself (a second numbering scheme was the source of the Phase 2 EOF bug).
std::string tokenName(int tokenCode);
