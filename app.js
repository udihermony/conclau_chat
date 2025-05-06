const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const app = express();
const port = 3000;

// Middleware to parse JSON bodies
app.use(express.json());

// Add request logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

// Serve static files from the current directory
app.use(express.static(path.join(__dirname)));

// Handle favicon requests
app.get('/favicon.ico', (req, res) => {
    console.log('Handling favicon request');
    res.status(204).end(); // No content response
});

// Serve tools.js as a module
app.get('/tools.js', (req, res) => {
    res.type('application/javascript');
    res.sendFile(path.join(__dirname, 'tools.js'));
});

// Endpoint to add a new tool
app.post('/api/tools', async (req, res) => {
    try {
        const { toolDefinition, executorFunction } = req.body;
        
        if (!toolDefinition || !executorFunction) {
            throw new Error('Both toolDefinition and executorFunction are required');
        }
        
        // Read the current tools.js file
        const toolsPath = path.join(__dirname, 'tools.js');
        let content = await fs.readFile(toolsPath, 'utf8');
        
        // Extract the tools array
        const toolsMatch = content.match(/const tools = \[([\s\S]*?)\];/);
        if (!toolsMatch) {
            throw new Error('Could not find tools array in tools.js');
        }
        
        // Add the new tool to the array
        const toolsArray = toolsMatch[1];
        const newToolsArray = toolsArray.replace(/];\s*\/\/ Add more tools here/, 
            `    ${JSON.stringify(toolDefinition, null, 4)},\n    // Add more tools here`);
        
        // Update the tools array in the content
        content = content.replace(toolsMatch[0], `const tools = [${newToolsArray}];`);
        
        // Add the executor
        const executorMatch = content.match(/const toolExecutors = {([\s\S]*?)};/);
        if (executorMatch) {
            const executors = executorMatch[1];
            if (!executors.includes(toolDefinition.function.name)) {
                const newExecutors = executors.replace(/};/, 
                    `    ${toolDefinition.function.name}: ${executorFunction},\n};`);
                content = content.replace(executorMatch[0], `const toolExecutors = {${newExecutors}};`);
            } else {
                // Update existing executor
                const executorRegex = new RegExp(`${toolDefinition.function.name}:\\s*[^,}]+`, 'g');
                content = content.replace(executorRegex, 
                    `${toolDefinition.function.name}: ${executorFunction}`);
            }
        }
        
        // Write the updated content back to the file
        await fs.writeFile(toolsPath, content, 'utf8');
        
        res.json({ success: true, message: 'Tool and executor added successfully' });
    } catch (error) {
        console.error('Error adding tool:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Serve index.html for the root route
app.get('/', (req, res) => {
    console.log('Serving index.html');
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).send('Something broke!');
});

app.listen(port, () => {
    console.log(`Example app listening at http://localhost:${port}`);
    console.log('Current directory:', __dirname);
    console.log('Static files being served from:', path.join(__dirname));
}); 