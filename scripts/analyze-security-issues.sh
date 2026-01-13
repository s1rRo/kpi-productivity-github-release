#!/bin/bash

# Скрипт для поиска типичных проблем безопасности, обнаруживаемых CodeQL

echo "🔍 Анализ типичных проблем безопасности в коде..."
echo ""

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_SRC="$ROOT_DIR/backend/src"
GATEWAY_SRC="$ROOT_DIR/gateway/src"

ISSUES_FOUND=0

# 1. Command Injection - использование child_process без экранирования
echo "1️⃣  Проверка Command Injection (child_process.exec/spawn)..."
COUNT=$(grep -r "child_process" "$BACKEND_SRC" "$GATEWAY_SRC" 2>/dev/null | wc -l)
if [ $COUNT -gt 0 ]; then
    echo "   ⚠️  Найдено $COUNT использований child_process"
    ISSUES_FOUND=$((ISSUES_FOUND + COUNT))
    grep -rn "child_process" "$BACKEND_SRC" "$GATEWAY_SRC" 2>/dev/null | head -5
fi
echo ""

# 2. SQL Injection - строковые шаблоны в SQL запросах
echo "2️⃣  Проверка SQL Injection (строковые шаблоны в SQL)..."
COUNT=$(grep -r "\$\{" "$BACKEND_SRC" "$GATEWAY_SRC" 2>/dev/null | grep -i "select\|insert\|update\|delete" | wc -l)
if [ $COUNT -gt 0 ]; then
    echo "   ⚠️  Найдено $COUNT возможных SQL injection"
    ISSUES_FOUND=$((ISSUES_FOUND + COUNT))
fi
echo ""

# 3. Path Traversal - небезопасная работа с путями
echo "3️⃣  Проверка Path Traversal (fs операции с пользовательским вводом)..."
COUNT=$(grep -r "readFile\|writeFile\|appendFile" "$BACKEND_SRC" "$GATEWAY_SRC" 2>/dev/null | grep -v "node_modules" | wc -l)
if [ $COUNT -gt 0 ]; then
    echo "   ⚠️  Найдено $COUNT файловых операций (требуют проверки)"
    ISSUES_FOUND=$((ISSUES_FOUND + COUNT))
fi
echo ""

# 4. Hardcoded Secrets
echo "4️⃣  Проверка Hardcoded Secrets..."
COUNT=$(grep -rE "(password|secret|api[_-]?key|token).*=.*['\"][^'\"]{10,}" "$BACKEND_SRC" "$GATEWAY_SRC" 2>/dev/null | grep -v "process.env" | wc -l)
if [ $COUNT -gt 0 ]; then
    echo "   ⚠️  Найдено $COUNT возможных hardcoded secrets"
    ISSUES_FOUND=$((ISSUES_FOUND + COUNT))
fi
echo ""

# 5. Missing Input Validation
echo "5️⃣  Проверка Missing Input Validation (прямое использование req.body/req.query)..."
COUNT=$(grep -rn "req\.body\|req\.query\|req\.params" "$BACKEND_SRC" "$GATEWAY_SRC" 2>/dev/null | grep -v "validate" | wc -l)
if [ $COUNT -gt 0 ]; then
    echo "   ⚠️  Найдено $COUNT использований req.body/query без явной валидации"
    ISSUES_FOUND=$((ISSUES_FOUND + COUNT / 10))  # Делим на 10, т.к. много дубликатов
fi
echo ""

# 6. Insecure Randomness - использование Math.random() для безопасности
echo "6️⃣  Проверка Insecure Randomness (Math.random для токенов/паролей)..."
COUNT=$(grep -rn "Math\.random()" "$BACKEND_SRC" "$GATEWAY_SRC" 2>/dev/null | wc -l)
if [ $COUNT -gt 0 ]; then
    echo "   ⚠️  Найдено $COUNT использований Math.random()"
    ISSUES_FOUND=$((ISSUES_FOUND + COUNT))
fi
echo ""

# 7. Prototype Pollution - небезопасное слияние объектов
echo "7️⃣  Проверка Prototype Pollution (небезопасное слияние объектов)..."
COUNT=$(grep -rn "Object\.assign\|\.\.\..*req\.\|merge(" "$BACKEND_SRC" "$GATEWAY_SRC" 2>/dev/null | wc -l)
if [ $COUNT -gt 0 ]; then
    echo "   ⚠️  Найдено $COUNT потенциально небезопасных операций слияния"
    ISSUES_FOUND=$((ISSUES_FOUND + COUNT / 5))
fi
echo ""

# 8. Missing Error Handling
echo "8️⃣  Проверка Missing Error Handling (промисы без .catch)..."
COUNT=$(grep -rn "\.then(" "$BACKEND_SRC" "$GATEWAY_SRC" 2>/dev/null | grep -v "\.catch\|try" | wc -l)
if [ $COUNT -gt 0 ]; then
    echo "   ⚠️  Найдено $COUNT промисов без обработки ошибок"
    ISSUES_FOUND=$((ISSUES_FOUND + COUNT / 10))
fi
echo ""

# 9. Information Exposure - логирование чувствительных данных
echo "9️⃣  Проверка Information Exposure (логирование паролей/токенов)..."
COUNT=$(grep -rn "console\.log.*password\|console\.log.*token\|console\.log.*secret" "$BACKEND_SRC" "$GATEWAY_SRC" 2>/dev/null | wc -l)
if [ $COUNT -gt 0 ]; then
    echo "   ⚠️  Найдено $COUNT случаев логирования чувствительных данных"
    ISSUES_FOUND=$((ISSUES_FOUND + COUNT))
fi
echo ""

# 10. Unsafe Regex - ReDoS уязвимости
echo "🔟 Проверка Unsafe Regex (потенциальные ReDoS)..."
COUNT=$(grep -rE "new RegExp\(.*\+|\/.*\(\.\*\)\+.*\/" "$BACKEND_SRC" "$GATEWAY_SRC" 2>/dev/null | wc -l)
if [ $COUNT -gt 0 ]; then
    echo "   ⚠️  Найдено $COUNT потенциально опасных regex"
    ISSUES_FOUND=$((ISSUES_FOUND + COUNT))
fi
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Всего найдено потенциальных проблем: ~$ISSUES_FOUND"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "💡 Для детального анализа см. CODEQL_SECURITY_ISSUES.md"
