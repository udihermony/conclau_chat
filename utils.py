import ffmpeg

def convert_webm_to_mp3(input_file, output_file):
    try:
        # Set up the conversion
        stream = ffmpeg.input(input_file)
        stream = ffmpeg.output(stream, output_file, format='mp3')
        
        # Run the conversion
        ffmpeg.run(stream, overwrite_output=True)
        print(f"Successfully converted {input_file} to {output_file}")
        
    except ffmpeg.Error as e:
        print(f"An error occurred: {e.stderr.decode()}")

# Example usage
convert_webm_to_mp3('test_song1.webm', 'test_song1.mp3')