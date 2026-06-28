You are an expert software engineer specializing in Python development and SVG-based user interfaces. Your task is to implement "The Beatdown," an audio pattern sequencer, based on the following detailed specification.

Your primary goal is to deliver a functional "first slice" of the core audio loop and a responsive SVG UI. Focus on validating the core audio engine before expanding to secondary systems like the Matchmaker.

---

### Project Name: The Beatdown

### System Overview & Goals

The Beatdown is an audio pattern sequencer designed to create complex musical patterns through a user-friendly, visually intuitive interface. The primary objective is to provide musicians and producers with a tool for intuitive creation and manipulation of audio sequences, prioritizing a direct and responsive experience.

### Architectural Design

The system will logically consist of the following main components, which you should structure as modular and interoperable units:

1.  **Audio Engine:** The core component responsible for generating and playing back audio (or MIDI events) based on patterns and sequences. It must handle timing, synchronization, and the triggering of sounds.
2.  **Pattern Editor:** A graphical interface for creating and modifying individual musical patterns. This will be a grid-based SVG component.
3.  **Sequencer:** Manages the playback order and looping of multiple patterns, forming a complete musical arrangement. It orchestrates the patterns and feeds them to the Audio Engine.
4.  **User Interface (UI):** The overall presentation layer, handling user input (e.g., mouse clicks, keyboard events) and displaying the current state of the system via SVG.

### Data Model

Define and implement clear data structures for the following core entities:

*   **Patterns:** Represents a single musical pattern. This should include:
    *   Note data (e.g., pitch, velocity, duration)
    *   Timing information (e.g., steps per beat, tempo)
    *   Instrument/sound assignments (abstracted initially, concrete later)
*   **Sequences:** A collection of `Pattern` IDs or instances, defining the order and repetition of patterns for a song structure.
*   **Modules (Sounds/Instruments):** Abstractions for the individual sound-producing units. Initially, these can be simple placeholders or map to basic waveforms/MIDI notes.

### User Interface (UI) Specification

The UI will be entirely SVG-based, ensuring scalability and customizability. The initial focus is on:

*   **Grid-based Pattern Editor:** An interactive SVG grid where users can "draw" notes/triggers within a pattern.
*   **Vault Selection:** A mechanism for selecting and managing different patterns and sequences. The UI should clearly indicate the currently selected Vault (pattern/sequence) with visual feedback. The council emphasized clear visual feedback for selection.
*   **Visual Feedback:** Crucial for user understanding. Selected patterns, sequences, and active steps during playback must have distinct visual indicators.

### Functional Requirements

The system *must* provide the following core functionality:

*   **Pattern Creation & Editing:** Users must be able to visually create, modify, and delete individual musical patterns using the SVG grid editor.
*   **Sequence Management:** Users must be able to define, arrange, and modify sequences of patterns.
*   **Real-time Playback:** The system must play back patterns and sequences in real-time, synchronized to a tempo.
*   **User Interaction:** The UI must respond to user input (e.g., clicking grid cells to add/remove notes, selecting vaults).

### Technical Requirements

*   **Programming Language:** Python
*   **UI Framework:** SVG for all graphical elements and interactions. You will need to manage SVG elements dynamically.
*   **Audio Output:** For the audio engine, you should choose a suitable Python audio library for real-time sound generation (e.g., `PyAudio`, `Sounddevice`, or `python-rtmidi` for MIDI output if simpler for a first slice). Make an informed choice and justify it.
*   **State Management:** A clear and maintainable way to manage the application's state (current pattern, sequence, playback status, UI selections).

### Council Discussions & Key Directives

*   **Prioritize Audio Engine:** The Audio Engine is primary. Focus on validating the core audio loop and ensuring the synth sounds appropriate, rather than getting sidetracked by secondary systems like the Matchmaker in this initial phase.
*   **Clear Visual Feedback:** Emphasized for Vault selection and active states.
*   **Mondrian-inspired Grid Aesthetics:** The overall visual style is a grid. Avoid redundant or overly complex borders; embrace the inherent grid structure for visual elegance.

### Implementation Plan (Suggested Initial Steps for You)

1.  **Core SVG UI Setup:** Create a basic Python script that renders an initial SVG grid for the pattern editor. Make it responsive to basic mouse interactions (e.g., changing cell color on click).
2.  **Basic Data Model:** Implement initial Python classes for `Pattern` and `Sequence`.
3.  **Basic Audio Engine (Placeholder):** Integrate your chosen audio library. Start with a simple "beep" or MIDI note trigger when a grid cell is activated, proving the real-time audio output.
4.  **Connect UI to Data:** Link UI interactions (e.g., clicking a grid cell) to modify the `Pattern` data model.
5.  **Basic Playback Loop:** Implement a timed loop that iterates through the `Pattern` data and triggers the audio engine.

### API Documentation (Illustrative, you will define and implement these)

#### Audio Engine API (Example)
*   `play_pattern(pattern_data: dict, tempo: int)`: Starts playing a given pattern.
*   `stop_playback()`: Stops all current audio playback.
*   `trigger_note(pitch: int, velocity: int, duration: float)`: Plays a single note.

#### Pattern Editor API (Example)
*   `add_note(pattern_id: str, step: int, pitch: int)`: Adds a note to a pattern at a specific step.
*   `remove_note(pattern_id: str, step: int, pitch: int)`: Removes a note from a pattern.
*   `render_pattern_svg(pattern_data: dict)`: Generates/updates the SVG representation of a pattern.

#### Sequencer API (Example)
*   `load_sequence(sequence_id: str)`: Loads a sequence for playback.
*   `start_sequence_playback()`: Starts playing the loaded sequence.
*   `set_tempo(bpm: int)`: Sets the global tempo.

---

Proceed with implementation according to this specification. Ask if any part of the design requires further clarification.