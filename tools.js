// Define tools array
export const tools = [
    {
        type: "function",
        function: {
            name: "add_numbers",
            description: "Add two numbers together. Use this when the user wants to perform addition.",
            parameters: {
                type: "object",
                properties: {
                    num1: {
                        type: "number",
                        description: "First number to add"
                    },
                    num2: {
                        type: "number",
                        description: "Second number to add"
                    }
                },
                required: ["num1", "num2"],
                additionalProperties: false
            }
        }
    },
    {
        type: "function",
        function: {
            name: "multiply_numbers",
            description: "Multiply two numbers together. Use this when the user wants to perform multiplication.",
            parameters: {
                type: "object",
                properties: {
                    num1: {
                        type: "number",
                        description: "First number to multiply"
                    },
                    num2: {
                        type: "number",
                        description: "Second number to multiply"
                    }
                },
                required: ["num1", "num2"],
                additionalProperties: false
            }
        }
    },
    {
        type: "function",
        function: {
            name: "transcribe_audio",
            description: "Open a file dialog to select an audio file for transcription. Returns a message indicating the file is being transcribed.",
            parameters: {
                type: "object",
                properties: {
                    file: {
                        type: "object",
                        description: "The audio file to transcribe, selected through the file input dialog"
                    }
                },
                required: ["file"],
                additionalProperties: false
            }
        }
    }
];

// Add requiresPopup property to tools that need it
tools.forEach(tool => {
    if (tool.function.name === 'transcribe_audio') {
        tool.requiresPopup = true;
    }
});

// Define tool executors
export const toolExecutors = {
    add_numbers: (num1, num2) => num1 + num2,
    multiply_numbers: (num1, num2) => num1 * num2,
    transcribe_audio: async (params) => {
        try {
            const formData = new FormData();
            formData.append('audio', params.file);

            const response = await fetch('/api/transcribe', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error);
            }

            // Return a message that will be shown to the user
            return {
                success: true,
                message: `Transcribing ${params.file.name}...`,
                transcription: result.transcription
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
}; 