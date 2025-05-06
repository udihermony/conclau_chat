# Conclau LLM Chat

A chat interface that integrates with LM Studio, providing a set of tools for enhanced interaction with the LLM.

## Features

* Tool-based interaction system
* Predefined set of utility tools
* Simple and intuitive interface
* Visual representation of conversations with collapsible thinking sections
* Code block formatting with syntax highlighting

## Available Tools

The system comes with the following built-in tools:

* `add_numbers`: Add two numbers together
* `multiply_numbers`: Multiply two numbers together

## Setup

1. Clone the repository:
```bash
git clone https://github.com/udihermony/conclau_chat.git
cd conclau_chat
```

2. Install dependencies:
```bash
npm install
```

3. Start the application:
```bash
npm start
```

## Configuration

The chat interface connects to LM Studio running on `http://localhost:1234`. Make sure LM Studio is running and the model is loaded before starting the application.

## Project Structure

* `index.html`: Main HTML file
* `script.js`: Client-side JavaScript for chat interface
* `tools.js`: Tool definitions and executors
* `styles.css`: Styling for the chat interface
* `server.js`: Express server for serving static files

## Adding New Tools

To add a new tool, edit the `tools.js` file and add:
1. A tool definition in the `tools` array
2. An executor function in the `toolExecutors` object

Example:
```javascript
{
    type: "function",
    function: {
        name: "your_tool_name",
        description: "Description of what your tool does",
        parameters: {
            type: "object",
            properties: {
                // Your parameters here
            },
            required: ["param1", "param2"],
            additionalProperties: false
        }
    }
}
```

## License

MIT License - feel free to use this project for any purpose. 