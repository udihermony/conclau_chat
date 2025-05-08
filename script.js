// Import tools and executors
import { tools, toolExecutors } from './tools.js';

// Global functions
let messagesContainer;

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

// Make functions globally available
window.executeTool = async function(toolName, params) {
    try {
        const tool = tools.find(t => t.function.name === toolName);
        if (!tool) {
            throw new Error(`Tool ${toolName} not found`);
        }

        // Execute the tool
        const result = await toolExecutors[toolName](params);
        
        // Add result to chat
        if (result.success) {
            if (result.message) {
                // Step 1: Show the transcribing message
                addMessage(result.message, false, true);
            }
            if (result.transcription) {
                // Step 2: Show the transcription result with preserved formatting
                const formattedTranscription = result.transcription
                    .split('\n')
                    .map(line => `<div class="transcription-line">${line}</div>`)
                    .join('');
                addMessage(`Transcription result:\n${formattedTranscription}`, false, true);
            }
        } else {
            addMessage(`Error: ${result.error}`, false, true);
        }
        
        // Close popup if it was open
        closeToolPopup();
        
        return result;
    } catch (error) {
        console.error(`Error executing tool ${toolName}:`, error);
        addMessage(`Error executing tool: ${error.message}`, false, true);
        throw error;
    }
};

window.handleFileSelect = function(input) {
    const fileInfo = document.getElementById('file-info');
    const fileName = document.getElementById('selected-file-name');
    
    if (input.files && input.files[0]) {
        fileName.textContent = input.files[0].name;
        fileInfo.style.display = 'block';
    } else {
        fileInfo.style.display = 'none';
    }
};

window.closeToolPopup = function() {
    const popup = document.getElementById('tool-popup');
    popup.style.display = 'none';
};

document.addEventListener('DOMContentLoaded', () => {
    messagesContainer = document.getElementById('messages');
    const userInput = document.getElementById('user-input');
    const sendButton = document.getElementById('send-button');

    // LLM API endpoint
    const API_URL = 'http://localhost:1234/v1/chat/completions';
    
    // Function to show tool popup
    function showToolPopup(toolName, toolConfig) {
        const popup = document.getElementById('tool-popup');
        const title = document.getElementById('tool-popup-title');
        const body = document.getElementById('tool-popup-body');
        
        // Set title
        title.textContent = toolConfig.function.name;
        
        // Create tool content based on tool type
        let content = '';
        switch (toolName) {
            case 'transcribe_audio':
                content = `
                    <div class="tool-item">
                        <p>Please select an audio file to transcribe:</p>
                        <input type="file" id="audio-file" accept="audio/*" onchange="handleFileSelect(this)">
                        <div id="file-info" style="margin-top: 10px; display: none;">
                            <p>Selected file: <span id="selected-file-name"></span></p>
                            <button id="transcribe-button" onclick="handleTranscribe()">Transcribe</button>
                        </div>
                    </div>
                `;
                break;
        }
        
        body.innerHTML = content;
        popup.style.display = 'flex';
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
                
                // Show tool popup
                const tool = tools.find(t => t.function.name === toolCall.function.name);
                if (tool) {
                    showToolPopup(toolCall.function.name, tool);
                }
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

    // Add close sidebar button handler
    const closeSidebarBtn = document.getElementById('close-sidebar');
    if (closeSidebarBtn) {
        closeSidebarBtn.addEventListener('click', () => {
            hideTranscriptionSidebar();
        });
    }
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

// Add these functions after the existing functions
window.showTranscriptionSidebar = function() {
    const sidebar = document.getElementById('transcription-sidebar');
    sidebar.classList.add('visible');
    document.getElementById('transcription-content').innerHTML = '';
};

window.hideTranscriptionSidebar = function() {
    const sidebar = document.getElementById('transcription-sidebar');
    sidebar.classList.remove('visible');
};

// Modify the handleTranscribe function
window.handleTranscribe = async function() {
    const button = document.getElementById('transcribe-button');
    const originalText = button.textContent;
    
    try {
        // Show loading state
        button.disabled = true;
        button.textContent = 'Transcribing...';
        
        // Show sidebar and close popup
        showTranscriptionSidebar();
        closeToolPopup();
        
        // Execute the transcription
        const result = await executeTool('transcribe_audio', {
            file: document.getElementById('audio-file').files[0]
        });
        
        if (result.success && result.transcription) {
            // Clear existing content
            const content = document.getElementById('transcription-content');
            content.innerHTML = '';
            
            // Split transcription into lines and add them to sidebar
            const lines = result.transcription.split('\n');
            lines.forEach(line => {
                if (line.trim()) {
                    const lineDiv = document.createElement('div');
                    lineDiv.className = 'transcription-line';
                    lineDiv.textContent = line;
                    content.appendChild(lineDiv);
                }
            });
        }
    } catch (error) {
        console.error('Transcription error:', error);
        addMessage(`Error during transcription: ${error.message}`, false, true);
        hideTranscriptionSidebar(); // Hide sidebar on error
    } finally {
        // Reset button state
        button.disabled = false;
        button.textContent = originalText;
    }
};
