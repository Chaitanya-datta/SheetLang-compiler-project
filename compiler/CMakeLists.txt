cmake_minimum_required(VERSION 3.20)

# C and CXX both enabled: LLVM's CMake package config performs some checks
# that expect a C compiler to be available, even though sheetc itself is
# pure C++.
project(SheetLang C CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# --- LLVM discovery (Phase 1) --------------------------------------------
if(APPLE)
    set(LLVM_DIR "/opt/homebrew/opt/llvm/lib/cmake/llvm" CACHE PATH "Path to LLVMConfig.cmake")
endif()
find_package(LLVM REQUIRED CONFIG)
message(STATUS "Found LLVM ${LLVM_PACKAGE_VERSION}")

# --- Flex discovery (Phase 2) --------------------------------------------
if(APPLE)
    set(FLEX_EXECUTABLE "/opt/homebrew/opt/flex/bin/flex" CACHE FILEPATH "Path to flex" FORCE)
endif()
find_package(FLEX REQUIRED)
message(STATUS "Using flex: ${FLEX_EXECUTABLE}")

# --- Bison discovery (Phase 3) -------------------------------------------
if(APPLE)
    set(BISON_EXECUTABLE "/opt/homebrew/opt/bison/bin/bison" CACHE FILEPATH "Path to bison" FORCE)
endif()
find_package(BISON REQUIRED)
message(STATUS "Using bison: ${BISON_EXECUTABLE}")

BISON_TARGET(SheetParser
    ${CMAKE_SOURCE_DIR}/parser/parser.y
    ${CMAKE_CURRENT_BINARY_DIR}/parser.tab.cpp
    DEFINES_FILE ${CMAKE_CURRENT_BINARY_DIR}/parser.tab.h
)

FLEX_TARGET(SheetLexer
    ${CMAKE_SOURCE_DIR}/lexer/lexer.l
    ${CMAKE_CURRENT_BINARY_DIR}/lexer.yy.cpp
)

# Ensures the lexer (which #includes parser.tab.h) is only compiled after
# Bison has generated that header.
ADD_FLEX_BISON_DEPENDENCY(SheetLexer SheetParser)

# --- sheetc executable ------------------------------------------------
add_executable(sheetc
    src/main.cpp
    src/Token.cpp
    src/AST.cpp
    src/SymbolTable.cpp
    src/SemanticAnalyzer.cpp
    src/DependencyGraph.cpp
    src/DependencyAnalyzer.cpp
    src/LLVMCodeGenerator.cpp
    src/NativeCodeGenerator.cpp
    ${FLEX_SheetLexer_OUTPUTS}
    ${BISON_SheetParser_OUTPUTS}
)

target_include_directories(sheetc PRIVATE
    ${CMAKE_SOURCE_DIR}/include
    ${CMAKE_CURRENT_BINARY_DIR}
    ${LLVM_INCLUDE_DIRS}
)

separate_arguments(LLVM_DEFINITIONS_LIST UNIX_COMMAND "${LLVM_DEFINITIONS}")
target_compile_definitions(sheetc PRIVATE ${LLVM_DEFINITIONS_LIST})

# --- LLVM linking (Phase 6/7) ----------------------------------------
# "core" covers IR construction (Module, IRBuilder, Constants, Verifier).
# "native" is LLVM's pseudo-component for "whatever target this machine
# actually is" (its Target/AsmPrinter/MC libraries) -- this is what Phase
# 7's NativeCodeGenerator needs to create a TargetMachine and emit an
# object file for the host, without hardcoding a specific architecture
# (x86-64 on the Linux test machine, AArch64 on the user's Apple Silicon
# Mac) anywhere in this file.
llvm_map_components_to_libnames(llvm_libs core native mc target support)
target_link_libraries(sheetc PRIVATE ${llvm_libs})
