class WriteUWU {
    constructor(ops = {}) {
        if (!ops.target || !(ops.target instanceof HTMLElement)) {
            throw new TypeError("[WriteUWU] Initialization failed. A valid DOM element is required for 'target'.");
        }
        this.target = ops.target;

        if (
            ops.speed !== undefined &&
            (typeof ops.speed !== "number" || ops.speed < 0)
        ) {
            throw new TypeError("[WriteUWU] Invalid 'speed' value. It must be a positive number.");
        }
        this.speed = ops.speed || 25;

        ["onStart", "onTyping", "onFinish"].forEach((cb) => {
            if (ops[cb] !== undefined && typeof ops[cb] !== "function") {
                throw new TypeError(`[WriteUWU] Invalid callback for '${cb}'. It must be a function.`);
            }
        });

        this.onStart = ops.onStart;
        this.onTyping = ops.onTyping;
        this.onFinish = ops.onFinish;

        this._context = {
            vars: {},
            funcs: {},
            aliases: {},
        };

        this._sys = {
            tokenIndex: 0,
            tokens: [],
            status: "idle",
            timeout: null,
            delayTimeout: null,
            delayResolve: null,
            maxExecutions: 1000,
            executions: 0,
        };

        this._api = {};
        Object.defineProperties(this._api, {
            tokens: {
                get: () => this._sys.tokens,
            },
            tokenIndex: {
                get: () => this._sys.tokenIndex,
            },
            progress: {
                get: () => {
                    const { tokenIndex, tokens } = this._sys;
                    const progress = tokens.length ? tokenIndex / tokens.length : 0;

                    return { raw: progress, percent: `${Math.round(progress * 100)}%` };
                },
            },
        });
    }

    get api() {
        return this._api;
    }

    isOnlyDirectives(text) {
        if (typeof text !== "string" || !text.trim()) return false;

        const tokens = this._parseText(text);
        if (tokens.length === 0) return false;

        return tokens.every((token) => token.startsWith("[@"));
    }

    write(text) {
        if (typeof text !== "string") {
            throw new TypeError("[WriteUWU] Invalid argument for 'write'. Expected a string.");
        }

        this._clear();
        this._sys.tokens = this._parseText(text);
        this._sys.status = "typing";
        this._runEvent("onStart");
        this._tick();
    }

    pause() {
        if (this._sys.status !== "typing") return;
        clearTimeout(this._sys.timeout);
        this._sys.status = "paused";
        this._sys.timeout = null;
    }

    resume() {
        if (this._sys.status !== "paused") return;
        this._sys.status = "typing";
        this._tick();
    }

    skip() {
        if (this._sys.status !== "typing") return;
        if (!document.body.contains(this.target)) return;

        this._clearTimers();
        this._sys.status = "skipping";

        const run = async () => {
            let text = "";
            while (this._sys.tokenIndex < this._sys.tokens.length) {
                if (++this._sys.executions > this._sys.maxExecutions) {
                    console.error("[WriteUWU] Skip aborted due to a potential infinite loop.");
                    break;
                }

                const token = this._sys.tokens[this._sys.tokenIndex];

                if (token.startsWith("[@")) {
                    const directive = this._parseDirective(token);

                    let isWaitDirective =
                        directive.type === "async" || directive.type === "delay";

                    if (this._context.aliases[directive.type]) {
                        const aliasType = this._context.aliases[directive.type].type;
                        if (aliasType === "async") isWaitDirective = true;
                    }

                    if (isWaitDirective) {
                        this._sys.tokenIndex += 1;
                        continue;
                    }

                    await this._runDirective(directive);
                    this._sys.tokenIndex += 1;
                    continue;
                }

                text += token;
                this._sys.tokenIndex += 1;
                this._sys.executions = 0;
            }

            this.target.innerHTML += text;
            this._tickFinishHandler();
        };

        run();
    }

    setVar(key, val) {
        if (typeof key !== "string" || !key.trim()) {
            throw new TypeError("[WriteUWU] Invalid variable name. 'setVar' requires a non-empty string key.");
        }

        this._context.vars[key] = val;
    }

    setFn(key, fn) {
        if (typeof key !== "string" || !key.trim()) {
            throw new TypeError("[WriteUWU] Invalid function name. 'setFn' requires a non-empty string key.");
        }

        if (typeof fn !== "function") {
            throw new TypeError(`[WriteUWU] Invalid function provided for key '${key}'. It must be a function.`);
        }

        this._context.funcs[key] = fn;
    }

    setFnAlias(key, functionName, type = "run") {
        if (typeof key !== "string" || !key.trim()) {
            throw new TypeError("[WriteUWU] Invalid alias name. 'setFnAlias' requires a non-empty string key.");
        }

        const reservedDirectives = [
            "speed",
            "delay",
            "var",
            "run",
            "async",
            "eval",
        ];

        if (reservedDirectives.includes(key)) {
            throw new Error(`[WriteUWU] Alias '${key}' conflicts with a built-in directive. Please choose another name.`);
        }

        if (typeof functionName !== "string" || !functionName.trim()) {
            throw new TypeError("[WriteUWU] Invalid function name. 'setFnAlias' requires a non-empty string 'functionName'.");
        }

        const validTypes = ["run", "async", "eval"];
        const resolvedType = validTypes.includes(type) ? type : "run";

        this._context.aliases[key] = {
            fnName: functionName,
            type: resolvedType,
        };
    }

    async _tick() {
        if (this._sys.status !== "typing") return;

        if (!document.body.contains(this.target)) {
            console.warn("[WriteUWU] Target element is no longer in the DOM. Execution aborted.");
            this._sys.status = "idle";
            this._clear();
            return;
        }

        if (++this._sys.executions > this._sys.maxExecutions) {
            console.error("[WriteUWU] Execution stopped due to a potential infinite loop in '_tick()'.");
            return;
        }

        if (this._sys.tokenIndex >= this._sys.tokens.length) {
            this._tickFinishHandler();
            return;
        }

        if (this._sys.tokens[this._sys.tokenIndex].startsWith("[@")) {
            await this._tickDirectiveContentHandler();
            return;
        }

        this._tickTypingHandler();

        this._sys.timeout = setTimeout(() => {
            this._tick();
        }, this.speed);
    }

    async _tickDirectiveContentHandler() {
        const directive = this._parseDirective(
            this._sys.tokens[this._sys.tokenIndex],
        );
        await this._runDirective(directive);
        this._sys.tokenIndex += 1;
        this._tick();
    }

    _tickTypingHandler() {
        this.target.innerHTML += this._sys.tokens[this._sys.tokenIndex];
        this._sys.tokenIndex += 1;
        this._sys.executions = 0;
        this._runEvent("onTyping");
    }

    _tickFinishHandler() {
        this._sys.status = "idle";
        this._runEvent("onFinish");

        this._clear();
    }

    async _runDirective({ type, value }) {
        if (this._sys.status !== "typing" && this._sys.status !== "skipping") {
            return;
        }

        if (this._context.aliases[type]) {
            const aliasInfo = this._context.aliases[type];
            type = aliasInfo.type;
            value = value ? `${aliasInfo.fnName}(${value})` : `${aliasInfo.fnName}()`;
        }

        if (!["speed", "delay", "var", "run", "async", "eval"].includes(type)) {
            console.warn(`[WriteUWU] Unknown directive '${type}'. It will be ignored.`);
            return;
        }

        if (type === "speed") {
            if (!value) return;

            const newSpeed = Number(value);
            if (isNaN(newSpeed) || newSpeed < 0) {
                console.warn(`[WriteUWU] Invalid speed value '${value}'. Directive ignored.`);
                return;
            }
            this.speed = newSpeed;
            return;
        }

        if (type === "delay") {
            if (!value) return;

            const delayTime = Number(value);
            if (isNaN(delayTime) || delayTime < 0) {
                console.warn(`[WriteUWU] Invalid delay value '${value}'. Directive ignored.`);
                return;
            }
            await new Promise((resolve) => {
                this._sys.delayResolve = resolve;
                this._sys.delayTimeout = setTimeout(() => {
                    this._sys.delayResolve = null;
                    resolve();
                }, delayTime);
            });
            return;
        }

        if (type === "var") {
            if (!value) return;
            if (!(value in this._context.vars)) {
                console.warn(`[WriteUWU] Variable '${value}' is not defined.`);
                return;
            }
            const val = this._unwrapDirective(this._context.vars[value]);
            this._injectNewToken(val);
            return;
        }

        if (type === "run" || type === "async" || type === "eval") {
            if (!value) return;

            const { fn, param, name } = this._unwrapFn(value);

            if (typeof fn !== "function") {
                console.warn(`[WriteUWU] Function '${name || value}' is not defined or not callable.`);
                return;
            }

            try {
                if (type === "run" || type === "async") {
                    type === "run" ? fn(param) : await fn(param);
                } else {
                    const val = this._unwrapDirective(fn(param));
                    this._injectNewToken(val);
                }
            } catch (error) {
                console.error(`[WriteUWU] Failed to execute function '${name || value}'.`, error);
            }
        }
    }

    _clearTimers() {
        clearTimeout(this._sys.timeout);
        clearTimeout(this._sys.delayTimeout);

        if (this._sys.delayResolve) {
            this._sys.delayResolve();
            this._sys.delayResolve = null;
        }

        this._sys.timeout = null;
        this._sys.delayTimeout = null;
    }

    _clear() {
        this._clearTimers();

        this._sys.tokenIndex = 0;
        this._sys.executions = 0;
        this._sys.tokens = [];
    }

    _injectNewToken(text) {
        if (text === null || text === undefined) return;
        const tokens = this._parseText(String(text));
        this._sys.tokens.splice(this._sys.tokenIndex + 1, 0, ...tokens);
    }

    _runEvent(eventName) {
        const fn = this[eventName];
        if (typeof fn !== "function") return;

        try {
            fn(this.api);
        } catch (error) {
            console.error(`[WriteUWU] Error occurred in event '${eventName}'.`, error);
        }
    }

    _unwrapDirective(token) {
        if (typeof token !== "string") return String(token || "");

        return token.replace(/\[@([^\]]+)\]/g, "$1");
    }

    _unwrapFn(value) {
        if (!value) return { fn: null, name: null, param: null };

        const match = value.match(/^(\w+)\((.*)\)$/);

        if (!match) {
            const fn = this._context.funcs[value] ?? null;
            return { fn, name: value, param: null };
        }

        const [, fnName, rawParam] = match;
        const fn = this._context.funcs[fnName];
        const param = rawParam?.length
            ? rawParam.replace(/^["']|["']$/g, "")
            : null;

        return { fn, name: fnName, param };
    }

    _parseText(str) {
        if (typeof str !== "string") return [];

        const openTagCount = (str.match(/\[@/g) || []).length;
        const closedTagCount = (str.match(/\[@[^\]]+\]/g) || []).length;

        if (openTagCount > closedTagCount) {
            const parts = str.split("[@");

            for (let i = 1; i < parts.length; i++) {
                if (!parts[i].includes("]")) {
                    const snippet = parts[i].substring(0, 30);
                    const ellipsis = parts[i].length > 30 ? "..." : "";

                    console.warn(`[WriteUWU] Detected an unclosed directive near "[@${snippet}${ellipsis}".`);
                }
            }
        }

        const tokens = str.match(
            /\[@[^\]]+\]|<[^>]+>|&[^;]+;|[\uD800-\uDBFF][\uDC00-\uDFFF]|./g,
        );

        return tokens || [];
    }

    _parseDirective(token) {
        if (!token || typeof token !== "string") return { type: "", value: "" };

        const content = token.slice(2, -1);
        const firstColonIndex = content.indexOf(":");

        if (firstColonIndex === -1) {
            return { type: content.trim(), value: "" };
        }

        return {
            type: content.slice(0, firstColonIndex).trim(),
            value: content.slice(firstColonIndex + 1).trim(),
        };
    }
}
