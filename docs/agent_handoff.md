## Agent Handoff Prompt: The Beatdown Audio Pattern Sequencer

### System Overview

The Beatdown is an audio pattern sequencer designed to create complex musical patterns through a user-friendly interface. The primary goal is to provide musicians and producers with a tool that allows for intuitive creation and manipulation of audio sequences.

### Key Components

1. **Audio Engine:** Responsible for playing and manipulating audio sequences.
2. **Pattern Editor:** A user interface for creating and editing patterns.
3. **Sequencer:** Manages the playback of patterns in a sequence.
4. **User Interface (UI):** Handles user input and displays the current state of the system.

### Data Models

- **Patterns:** Represent a single musical pattern, including note data and timing information.
- **Sequences:** A collection of patterns played in a specific order.
- **Modules:** Reusable components that can be used to create patterns.

### User Interface (UI) Specification

- **Grid-based Pattern Editor:** A grid-based interface for creating and editing patterns.
- **Vault Selection:** A mechanism for selecting and managing different patterns and sequences.
- **Visual Feedback:** Visual indicators for selected patterns, sequences, and modules.

### Functional Requirements

- **Pattern Creation:** Allow users to create and edit patterns using the pattern editor.
- **Sequence Management:** Enable users to create and manage sequences of patterns.
- **Playback:** Play back patterns and sequences in real-time.
- **User Input:** Handle user input from the UI and update the system state accordingly.

### Technical Requirements

- **Programming Language:** Python
- **UI Library:** SVG
- **Audio Library:** TBD

### Implementation Plan

1. **Audio Engine Development:** Develop the audio engine and integrate it with the pattern editor.
2. **UI Development:** Create the UI using SVG and integrate it with the audio engine.
3. **Sequencer Development:** Develop the sequencer and integrate it with the UI and audio engine.

### API Documentation

#### Audio Engine API
- **play_sequence:** Play a sequence of patterns.
- **stop_sequence:** Stop playing a sequence.
- **manipulate_pattern:** Manipulate a pattern.

#### Pattern Editor API
- **create_pattern:** Create a new pattern.
- **edit_pattern:** Edit an existing pattern.
- **delete_pattern:** Delete a pattern.

#### Sequencer API
- **create_sequence:** Create a new sequence.
- **add_pattern_to_sequence:** Add a pattern to a sequence.
- **remove_pattern_from_sequence:** Remove a pattern from a sequence.

### Council Discussions

The council has discussed the following topics:
- **Visual Feedback:** The need for clear visual feedback when selecting patterns and sequences.
- **Vault Selection:** The importance of a user-friendly vault selection mechanism.

### Notes

- The implementation should be structured to allow for easy extension and maintenance.
- The system should be designed with scalability in mind to accommodate future features and improvements.
- The UI should be intuitive and provide clear visual feedback to enhance the user experience.

### Handoff Instructions

- The agent should start by implementing the Audio Engine, ensuring it can play and manipulate audio sequences.
- Next, the UI should be developed using SVG, with a focus on creating a grid-based pattern editor and providing visual feedback.
- Finally, the sequencer should be implemented to manage the playback of patterns in a sequence, integrating with both the audio engine and the UI.

This prompt provides a comprehensive overview of the system architecture, data models, and technical requirements for The Beatdown audio pattern sequencer. It serves as a guide for the agent to follow during the implementation process.