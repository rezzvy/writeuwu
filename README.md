# WriteUWU

## Overview

Simple Interactive Typewriter for Web

- Works with standard HTML tags and entities.
- Control speeds, pauses, and functions directly inside your text.
- No external dependencies required.

## Installation and Usage

1. Include the source file in your project, either manually or by using the CDN:

```html
<script src="https://cdn.jsdelivr.net/gh/rezzvy/writeuwu@latest/dist/writeuwu.min.js"></script>
```

2. Create a target element in your HTML:

```html
<div class="text"></div>
```

3. Initialize the instance and start the writer:

```javascript
const uwu = new WriteUWU({ target: document.querySelector(".text") });

uwu.write("Let's count! [@delay:1000] One...[@delay:1000] Two...[@delay:1000] and three!");
```

## Documentation

### Basic Options

Create a new instance by passing an options object:

```javascript
const uwu = new WriteUWU({
  target: document.querySelector(".text"),
  speed: 25,
  onStart(api) {
    console.log("Started writing. Progress:", api.progress.percent);
  },
  onTyping(api) {
    console.log("Typing token index:", api.tokenIndex);
  },
  onFinish(api) {
    console.log("Finished! Final progress:", api.progress.percent);
  },
});
```

| Option     | Type          | Default      | Description                                                            |
| ---------- | ------------- | ------------ | ---------------------------------------------------------------------- |
| `target`   | `HTMLElement` | **Required** | The DOM element where the text will be rendered.                       |
| `speed`    | `Number`      | `25`         | Typing speed in milliseconds per character. Must be a positive number. |
| `onStart`  | `Function`    | `-`          | Callback triggered when the typing process begins.                     |
| `onTyping` | `Function`    | `-`          | Callback triggered after every character is typed.                     |
| `onFinish` | `Function`    | `-`          | Callback triggered when the typing process completes.                  |

### Available Methods

#### `write(text: string)`

Starts the typing process for the provided string. Clears any ongoing writing process.

```javascript
uwu.write("Hello world!");
```

#### `pause()`

Pauses the current typing process.

```javascript
uwu.pause();
```

#### `resume()`

Resumes the typing process if it was previously paused.

```javascript
uwu.resume();
```

#### `skip()`

Instantly finishes the typing process. It will immediately output the remaining text and execute any pending non-wait directives (like `eval` or `run`), skipping `delay` and `async` directives.

```javascript
uwu.skip();
```

#### `setVar(key: string, value: any)`

Defines a variable that can be injected into the text stream using the `[@var:key]` directive.

```javascript
uwu.setVar("name", "Reza");
uwu.write("Hello [@var:name]!"); // Outputs: Hello Reza!
```

#### `setFn(key: string, fn: Function)`

Registers a function that can be executed inside the text stream using directives.

```javascript
uwu.setFn("alertMe", (msg) => {
  alert(msg);
});

uwu.write("Hello! [@run:alertMe('Hi there')]");
```

#### `setFnAlias(alias: string, functionName: string, type?: string)`

Creates a custom directive alias for a registered function. This allows for cleaner syntax in your text.

Supported types:

- `"run"` (Default) → Executes the function normally.
- `"async"` → Awaits an asynchronous function.
- `"eval"` → Injects the function's returned value into the text stream.

```javascript
uwu.setFn("log", (msg) => console.log(msg));
uwu.setFnAlias("print", "log", "run");

uwu.write("Testing... [@print:'Hello']");
```

### Directive Syntax

Directives allow you to embed commands directly inside your text strings. All directives follow this format: `[@type:value]`

#### Built-in Directives

##### `[@speed:value]`

Changes the typing speed dynamically.

```javascript
uwu.write("Normal speed... [@speed:10] Super fast!");
```

##### `[@delay:ms]`

Pauses the typing process for a specified duration in milliseconds.

```javascript
uwu.write("Wait for it...[@delay:2000] Boom!");
```

##### `[@var:key]`

Injects a previously registered variable into the text.

```javascript
uwu.setVar("username", "Reza");
uwu.write("Hi [@var:username]!");
```

##### `[@run:fn(param)]`

Executes a registered function synchronously.

```javascript
uwu.setFn("log", (msg) => console.log(msg));
uwu.write("Check your console! [@run:log('Hello Developer')]");
```

##### `[@async:fn(param)]`

Executes a registered asynchronous function and pauses the typewriter until the Promise resolves.

```javascript
uwu.setFn("wait", async (ms) => {
  return new Promise((r) => setTimeout(r, ms));
});

uwu.write("Loading...[@async:wait(2000)] Done!");
```

##### `[@eval:fn(param)]`

Executes a registered function and dynamically injects its return value into the text stream.

```javascript
uwu.setFn("getTime", () => new Date().toLocaleTimeString());

uwu.write("Current time: [@eval:getTime()]");
```

### API Object

Every event callback (`onStart`, `onTyping`, `onFinish`) receives an `api` object containing the current state of the typewriter.

```javascript
onTyping(api) {
  console.log("Tokens Array:", api.tokens);
  console.log("Current Index:", api.tokenIndex);
  console.log("Raw Progress (0-1):", api.progress.raw);
  console.log("Percent:", api.progress.percent);
}

```

#### Properties

| Property           | Description                                                     |
| ------------------ | --------------------------------------------------------------- |
| `tokens`           | Array of parsed tokens (characters, HTML tags, and directives). |
| `tokenIndex`       | The current typing position index.                              |
| `progress.raw`     | Typing progress as a decimal number (`0` to `1`).               |
| `progress.percent` | Typing progress as a formatted string (e.g., `"50%"`).          |

### Utility Methods

#### `isOnlyDirectives(text: string)`

Checks if a string consists entirely of directives without any renderable text. Returns a boolean.

```javascript
uwu.isOnlyDirectives("[@delay:1000][@speed:50]"); // true
uwu.isOnlyDirectives("Hello [@delay:1000]"); // false
```

### HTML Support

WriteUWU parses and supports:

- **HTML Tags:** `<b>bold</b>`, `<i>italic</i>`, `<br>`, etc.
- **HTML Entities:** `&nbsp;`, `&amp;`, etc.
- **Unicode & Emojis:** 👨‍💻✨

Example:

```javascript
uwu.write("Hello <b>World</b>! &nbsp; ✨");
```

## Contributing

There's always room for improvement. Feel free to contribute!

## Licensing

The library is licensed under MIT License. Check the license file for more details.
