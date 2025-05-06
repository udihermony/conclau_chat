// Add this endpoint after the existing endpoints
app.post('/api/tools', (req, res) => {
    try {
        const { toolDefinition, executorFunction } = req.body;
        
        if (!toolDefinition || !executorFunction) {
            return res.status(400).json({ 
                success: false, 
                error: 'Both toolDefinition and executorFunction are required' 
            });
        }

        // Validate the tool definition
        if (!toolDefinition.type || !toolDefinition.function) {
            return res.status(400).json({ 
                success: false, 
                error: 'Invalid tool definition format' 
            });
        }

        // Add the tool to the tools array
        tools.push(toolDefinition);

        // Create and add the executor function
        try {
            const executor = new Function(`return ${executorFunction}`)();
            toolExecutors[toolDefinition.function.name] = executor;
        } catch (error) {
            // Remove the tool if executor creation fails
            tools.pop();
            return res.status(400).json({ 
                success: false, 
                error: 'Invalid executor function: ' + error.message 
            });
        }

        res.json({ 
            success: true, 
            message: 'Tool added successfully',
            tool: toolDefinition
        });
    } catch (error) {
        console.error('Error adding tool:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to add tool: ' + error.message 
        });
    }
}); 