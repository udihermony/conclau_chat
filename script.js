// Import tools and executors
import { tools, toolExecutors } from './tools.js';

document.addEventListener('DOMContentLoaded', () => {
    const messagesContainer = document.getElementById('messages');
    const userInput = document.getElementById('user-input');
    const sendButton = document.getElementById('send-button');

    // LLM API endpoint
    const API_URL = 'http://localhost:1234/v1/chat/completions';
    
    // Function to create a collapsible thinking section
    function createThinkingSection(content) {
        const section = document.createElement('div');
        section.className = 'thinking-section';
        
        const header = document.createElement('div');
        header.className = 'thinking-header';
        header.innerHTML = '🤔 Thinking Process <span class="toggle-icon">▼</span>';
        
        const thinkingContent = document.createElement('div');
        thinkingContent.className = 'thinking-content';
        thinkingContent.textContent = content;
        
        header.addEventListener('click', () => {
            thinkingContent.classList.toggle('expanded');
            header.querySelector('.toggle-icon').textContent = 
                thinkingContent.classList.contains('expanded') ? '▼' : '▶';
        });
        
        section.appendChild(header);
        section.appendChild(thinkingContent);
        return section;
    }
    
    // Function to format code blocks
    function formatCodeBlock(code, language) {
        const codeBlock = document.createElement('div');
        codeBlock.className = 'code-block';
        
        const langLabel = document.createElement('div');
        langLabel.className = 'language';
        langLabel.textContent = language;
        
        const codeContent = document.createElement('pre');
        codeContent.textContent = code;
        
        codeBlock.appendChild(langLabel);
        codeBlock.appendChild(codeContent);
        return codeBlock;
    }
    
    // Function to format markdown-like content
    function formatMarkdown(content) {
        const container = document.createElement('div');
        container.className = 'markdown-content';
        
        // Split content into sections
        const sections = content.split(/```(\w+)?\n/);
        let isCode = false;
        let currentLanguage = '';
        
        sections.forEach((section, index) => {
            if (index === 0) {
                // First section is always text
                container.innerHTML = section
                    .replace(/### (.*?)\n/g, '<h3>$1</h3>')
                    .replace(/## (.*?)\n/g, '<h2>$1</h2>')
                    .replace(/\n- (.*?)(?=\n|$)/g, '<li>$1</li>')
                    .replace(/(<li>.*?<\/li>)/g, '<ul>$1</ul>');
            } else if (isCode) {
                // This is the end of a code block
                container.appendChild(formatCodeBlock(section, currentLanguage));
                isCode = false;
            } else {
                // This is the start of a code block
                currentLanguage = section || 'text';
                isCode = true;
            }
        });
        
        return container;
    }
    
    // Function to add a message to the chat
    function addMessage(content, isUser = false, isTool = false) {
        const messageDiv = document.createElement('div');
        messageDiv.className = isUser ? 'user-message' : (isTool ? 'tool-message' : 'assistant-message');
        
        if (isUser) {
            const messagePara = document.createElement('p');
            messagePara.textContent = content;
            messageDiv.appendChild(messagePara);
        } else {
            // Check if the content contains thinking process
            const thinkingMatch = content.match(/<think>(.*?)<\/think>/s);
            if (thinkingMatch) {
                const thinkingContent = thinkingMatch[1].trim();
                const thinkingSection = createThinkingSection(thinkingContent);
                messageDiv.appendChild(thinkingSection);
                
                // Remove the thinking section from the content
                content = content.replace(/<think>.*?<\/think>/s, '').trim();
            }
            
            // Format the remaining content
            const formattedContent = formatMarkdown(content);
            messageDiv.appendChild(formattedContent);
        }
        
        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
    
    // Function to display loading indicator
    function showLoading() {
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'loading-message';
        loadingDiv.id = 'loading-indicator';
        
        const loadingText = document.createElement('p');
        loadingText.textContent = 'Thinking...';
        loadingDiv.appendChild(loadingText);
        
        messagesContainer.appendChild(loadingDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
    
    // Function to remove loading indicator
    function hideLoading() {
        const loadingIndicator = document.getElementById('loading-indicator');
        if (loadingIndicator) {
            loadingIndicator.remove();
        }
    }
    
    // Function to execute a tool
    function executeTool(toolName, args) {
        if (toolExecutors[toolName]) {
            return toolExecutors[toolName](...Object.values(args));
        }
        throw new Error(`Unknown tool: ${toolName}`);
    }
    
    // Function to send message to LLM API
    async function sendMessageToLLM(userMessage) {
        try {
            showLoading();
            
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: "qwen3-8b",
                    messages: [
                        {
                            role: "user",
                            content: userMessage
                        }
                    ],
                    tools: tools,
                    temperature: 0.7
                })
            });
            
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            
            const data = await response.json();
            hideLoading();
            
            // Handle tool calls if present
            if (data.choices[0].message.tool_calls) {
                const toolCall = data.choices[0].message.tool_calls[0];
                const functionArgs = JSON.parse(toolCall.function.arguments);
                
                addMessage(`Tool called: ${toolCall.function.name} with arguments: ${JSON.stringify(functionArgs)}`, false, true);
                
                // Execute the tool function
                const result = executeTool(toolCall.function.name, functionArgs);
                const toolResponse = {
                    role: "tool",
                    tool_call_id: toolCall.id,
                    name: toolCall.function.name,
                    content: JSON.stringify({ result: result })
                };
                
                // Add the tool response to the messages
                addMessage(`Result: ${result}`, false, true);
                
                // Make a follow-up request with the tool response
                const followUpResponse = await fetch(API_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        model: "qwen3-8b",
                        messages: [
                            {
                                role: "user",
                                content: userMessage
                            },
                            data.choices[0].message,
                            toolResponse
                        ],
                        temperature: 0.7
                    })
                });
                
                const followUpData = await followUpResponse.json();
                addMessage(followUpData.choices[0].message.content);
            } else {
                // Extract the assistant's response from the API response
                const assistantResponse = data.choices[0].message.content;
                addMessage(assistantResponse);
            }
        } catch (error) {
            hideLoading();
            console.error('Error:', error);
            addMessage('Sorry, there was an error processing your request. Please try again later.');
        }
    }
    
    // Function to handle sending a message
    function handleSendMessage() {
        const message = userInput.value.trim();
        
        if (message) {
            // Add user message to chat
            addMessage(message, true);
            
            // Clear input field
            userInput.value = '';
            
            // Send message to LLM API
            sendMessageToLLM(message);
        }
    }
    
    // Event listeners
    sendButton.addEventListener('click', handleSendMessage);
    
    userInput.addEventListener('keydown', (e) => {
        // Send message on Enter key (without Shift)
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    });
    
    // Focus on input field when page loads
    userInput.focus();
});

// Add this function after the toolExecutors import
async function addNewTool(toolDefinition, executorFunction) {
    try {
        const response = await fetch('/api/tools', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                toolDefinition,
                executorFunction: executorFunction.toString()
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to add tool');
        }
        
        const result = await response.json();
        if (result.success) {
            // Reload the page to get the updated tools
            window.location.reload();
        } else {
            throw new Error(result.error || 'Failed to add tool');
        }
    } catch (error) {
        console.error('Error adding tool:', error);
        throw error;
    }
}

// Example usage:
// const newTool = {
//     type: "function",
//     function: {
//         name: "subtract_numbers",
//         description: "Subtract the second number from the first number.",
//         parameters: {
//             type: "object",
//             properties: {
//                 num1: {
//                     type: "number",
//                     description: "Number to subtract from"
//                 },
//                 num2: {
//                     type: "number",
//                     description: "Number to subtract"
//                 }
//             },
//             required: ["num1", "num2"],
//             additionalProperties: false
//         }
//     }
// };
// 
// const executor = function(num1, num2) {
//     return num1 - num2;
// };
// 
// addNewTool(newTool, executor);