const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');  // Add synchronous fs for existsSync
const multer = require('multer');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
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

// Configure multer for file upload
const upload = multer({ dest: 'uploads/' });

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fsSync.existsSync(uploadsDir)) {
    fsSync.mkdirSync(uploadsDir);
}

// API endpoint for transcribing audio
app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No audio file provided' });
        }

        const filePath = req.file.path;
        const outputDir = path.dirname(filePath);
        console.log('Processing file:', filePath);
        console.log('Output directory:', outputDir);

        // Run whisper command using the full path from virtual environment
        const whisperCmd = `/Users/ehud/git_repos/conclau_llm/venv/bin/whisper "${filePath}" --output_format txt --output_dir "${outputDir}"`;
        console.log('Running command:', whisperCmd);
        
        try {
            const { stdout, stderr } = await execPromise(whisperCmd);
            
            if (stderr) {
                console.error('Whisper stderr:', stderr);
            }
            if (stdout) {
                console.log('Whisper stdout:', stdout);
            }
        } catch (execError) {
            console.error('Error executing whisper command:', execError);
            throw new Error(`Whisper command failed: ${execError.message}`);
        }

        // Read the transcription file
        const transcriptionPath = path.join(outputDir, path.basename(filePath, path.extname(filePath)) + '.txt');
        console.log('Looking for transcription file:', transcriptionPath);
        
        try {
            const transcription = await fs.readFile(transcriptionPath, 'utf8');
            console.log('Successfully read transcription file');

            // Clean up the files
            await fs.unlink(filePath);
            await fs.unlink(transcriptionPath);

            // Split the transcription into lines and format each line
            const formattedTranscription = transcription
                .split('\n')
                .filter(line => line.trim()) // Remove empty lines
                .map(line => {
                    // Extract timestamp and text
                    const match = line.match(/\[(.*?)\](.*)/);
                    if (match) {
                        const [_, timestamp, text] = match;
                        return `${timestamp.trim()} - ${text.trim()}`;
                    }
                    return line;
                })
                .join('\n');

            res.json({
                success: true,
                transcription: formattedTranscription
            });
        } catch (readError) {
            console.error('Error reading transcription file:', readError);
            throw new Error(`Failed to read transcription file: ${readError.message}`);
        }
    } catch (error) {
        console.error('Error transcribing audio:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Helper function to get all files in a directory recursively
async function getAllFiles(dir) {
    const files = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        // Skip node_modules and .git directories
        if (entry.name === 'node_modules' || entry.name === '.git') {
            continue;
        }
        
        if (entry.isDirectory()) {
            files.push(...await getAllFiles(fullPath));
        } else {
            files.push(fullPath);
        }
    }
    
    return files;
}

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

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Example app listening at http://localhost:${PORT}`);
    console.log('Current directory:', __dirname);
    console.log('Static files being served from:', __dirname);
}); 