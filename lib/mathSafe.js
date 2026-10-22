function tokenize(expr) {
    const tokens = [];
    let i = 0;
    while (i < expr.length) {
        const ch = expr[i];
        if (/\s/.test(ch)) { i++; continue; }
        if (/[0-9.]/.test(ch)) {
            let num = "";
            let hasDot = false;
            while (i < expr.length && /[0-9.]/.test(expr[i])) {
                if (expr[i] === ".") {
                    if (hasDot) throw new Error("Invalid number");
                    hasDot = true;
                }
                num += expr[i++];
            }
            tokens.push({ type: "num", value: parseFloat(num) });
            continue;
        }
        if ("+-*/()".includes(ch)) {
            tokens.push({ type: "op", value: ch });
            i++;
            continue;
        }
        throw new Error(`Invalid character: ${ch}`);
    }
    return tokens;
}

function parse(tokens) {
    let pos = 0;
    function peek() { return tokens[pos]; }
    function consume() { return tokens[pos++]; }

    function parseExpression() {
        let node = parseTerm();
        while (peek() && "+-".includes(peek().value)) {
            const op = consume().value;
            node = { type: "bin", op, left: node, right: parseTerm() };
        }
        return node;
    }

    function parseTerm() {
        let node = parseFactor();
        while (peek() && "*/".includes(peek().value)) {
            const op = consume().value;
            node = { type: "bin", op, left: node, right: parseFactor() };
        }
        return node;
    }

    function parseFactor() {
        const tok = peek();
        if (!tok) throw new Error("Unexpected end");
        if (tok.type === "num") { consume(); return { type: "num", value: tok.value }; }
        if (tok.value === "(") { consume(); const node = parseExpression(); if (!peek() || peek().value !== ")") throw new Error("Missing )"); consume(); return node; }
        if (tok.value === "-") { consume(); return { type: "unary", op: "-", right: parseFactor() }; }
        if (tok.value === "+") { consume(); return parseFactor(); }
        throw new Error(`Unexpected token: ${tok.value}`);
    }

    const ast = parseExpression();
    if (pos !== tokens.length) throw new Error("Extra tokens");
    return ast;
}

function evaluate(node) {
    if (node.type === "num") return node.value;
    if (node.type === "unary") return -evaluate(node.right);
    const l = evaluate(node.left);
    const r = evaluate(node.right);
    switch (node.op) {
        case "+": return l + r;
        case "-": return l - r;
        case "*": return l * r;
        case "/": return r === 0 ? NaN : l / r;
    }
}

function evaluateMath(expr) {
    const tokens = tokenize(expr);
    const ast = parse(tokens);
    return evaluate(ast);
}

module.exports = { evaluateMath };