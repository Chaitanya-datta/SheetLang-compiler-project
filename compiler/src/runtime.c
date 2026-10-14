#include <stdlib.h>
#include <string.h>
#include <ctype.h>

const char* sheetlang_concat(const char* a, const char* b) {
    if (!a) a = "";
    if (!b) b = "";
    size_t len_a = strlen(a);
    size_t len_b = strlen(b);
    char* result = (char*)malloc(len_a + len_b + 1);
    strcpy(result, a);
    strcat(result, b);
    return result;
}

const char* sheetlang_upper(const char* a) {
    if (!a) return "";
    size_t len = strlen(a);
    char* result = (char*)malloc(len + 1);
    for (size_t i = 0; i < len; ++i) {
        result[i] = toupper((unsigned char)a[i]);
    }
    result[len] = '\0';
    return result;
}

const char* sheetlang_lower(const char* a) {
    if (!a) return "";
    size_t len = strlen(a);
    char* result = (char*)malloc(len + 1);
    for (size_t i = 0; i < len; ++i) {
        result[i] = tolower((unsigned char)a[i]);
    }
    result[len] = '\0';
    return result;
}

const char* sheetlang_trim(const char* a) {
    if (!a) return "";
    size_t len = strlen(a);
    const char* start = a;
    const char* end = a + len - 1;
    
    while (*start && isspace((unsigned char)*start)) {
        start++;
    }
    while (end > start && isspace((unsigned char)*end)) {
        end--;
    }
    
    size_t new_len = end >= start ? (size_t)(end - start + 1) : 0;
    char* result = (char*)malloc(new_len + 1);
    if (new_len > 0) {
        memcpy(result, start, new_len);
    }
    result[new_len] = '\0';
    return result;
}
