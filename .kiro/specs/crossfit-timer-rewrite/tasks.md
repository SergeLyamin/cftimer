# Implementation Plan

- [ ] 1. Set up project structure and core interfaces
  - Create directory structure for components, services, and utilities
  - Define TypeScript interfaces for all core components (IApp, ITimer, IEventBus, etc.)
  - Set up build configuration with TypeScript, Tailwind CSS, and bundling
  - Create base HTML template with responsive design structure
  - _Requirements: 10.1, 10.2_

- [ ] 2. Implement core application infrastructure
- [ ] 2.1 Create Event Bus system
  - Implement EventBus class with emit, on, once, off methods
  - Define AppEvents enum with all application events
  - Write unit tests for event subscription and emission
  - _Requirements: 10.1, 10.3_

- [ ] 2.2 Implement State Manager
  - Create StateManager class with state persistence and synchronization
  - Implement state subscription mechanism for reactive updates
  - Add state validation and error handling
  - Write unit tests for state management operations
  - _Requirements: 10.1, 12.1, 12.2_

- [ ] 2.3 Create Application Core
  - Implement App class with initialization and navigation logic
  - Add screen management with parameter passing support
  - Integrate EventBus and StateManager into application core
  - Write unit tests for application lifecycle and navigation
  - _Requirements: 1.1, 1.2, 10.1_

- [ ] 3. Implement service layer
- [ ] 3.1 Create Storage Service
  - Implement StorageService with localStorage fallback handling
  - Add data serialization and validation for stored settings
  - Implement graceful degradation when storage is unavailable
  - Write unit tests for storage operations and error scenarios
  - _Requirements: 12.1, 12.2, 12.3, 12.4_

- [ ] 3.2 Implement Audio Service
  - Create AudioService with sound loading and playback functionality
  - Add volume control and sound pack switching capabilities
  - Implement audio context management and error handling
  - Write unit tests for audio operations and fallback behavior
  - _Requirements: 3.3, 3.4, 14.1, 14.2, 14.3, 14.5_

- [ ] 3.3 Create Config Service
  - Implement ConfigService with built-in timer presets (Tabata, EMOM, Fight Gone Bad)
  - Add preset loading and validation logic
  - Create stub methods for custom presets (MVP limitation)
  - Write unit tests for preset management and configuration loading
  - _Requirements: 13.1, 13.2, 13.3, 13.4_

- [ ] 4. Implement timer engine
- [ ] 4.1 Create base timer infrastructure
  - Implement BaseTimer abstract class with common timer functionality
  - Add precise timing using performance.now() with drift compensation
  - Create TimerState and TimerConfig interfaces with validation
  - Write unit tests for base timer operations and timing accuracy
  - _Requirements: 3.1, 10.2_

- [ ] 4.2 Implement Interval Timer
  - Create IntervalTimer class extending BaseTimer
  - Add support for cycles, rounds, work/rest phases with countdown
  - Implement phase transitions with appropriate sound triggers
  - Write unit tests for interval timer logic and phase management
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.2, 3.3, 3.4_

- [ ] 4.3 Implement For Time Timer
  - Create ForTimeTimer class with forward counting logic
  - Add target time tracking and completion detection
  - Implement countdown phase and finish notifications
  - Write unit tests for for-time timer functionality
  - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [ ] 4.4 Implement AMRAP Timer
  - Create AmrapTimer class with backward counting logic
  - Add time limit enforcement and completion handling
  - Implement countdown phase and finish notifications
  - Write unit tests for AMRAP timer functionality
  - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [ ] 4.5 Create Clock Timer
  - Implement ClockTimer for fullscreen time display
  - Add real-time clock updates with proper formatting
  - Integrate with fullscreen API for enhanced display
  - Write unit tests for clock functionality and time formatting
  - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [ ] 5. Implement WebSocket communication
- [ ] 5.1 Create WebSocket Service
  - Implement WebSocketService with connection management and auto-reconnection
  - Add message serialization, validation, and error handling
  - Create heartbeat mechanism for connection monitoring
  - Write unit tests for WebSocket operations and reconnection logic
  - _Requirements: 5.1, 5.3, 5.7, 11.3_

- [ ] 5.2 Implement server-side WebSocket handler
  - Create WebSocket server with connection management
  - Add message routing between host and controller devices
  - Implement QR code generation for remote access
  - Write integration tests for client-server communication
  - _Requirements: 5.1, 5.2, 5.7_

- [ ] 5.3 Add state synchronization logic
  - Implement bidirectional state synchronization between devices
  - Add conflict resolution for simultaneous state changes
  - Create control takeover mechanism with notifications
  - Write integration tests for multi-device synchronization
  - _Requirements: 5.3, 5.4, 5.5, 5.6_

- [ ] 6. Create user interface screens
- [ ] 6.1 Implement Main Menu Screen
  - Create MainMenuScreen with timer type selection and ready-made presets
  - Add responsive design for mobile and desktop layouts
  - Integrate clock display in bottom-left corner with click handler
  - Write unit tests for menu interactions and navigation
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 9.1, 13.1_

- [ ] 6.2 Create Timer Setup Screens
  - Implement TimerSetupScreen with parameter validation and preset loading
  - Add form controls for all timer types with proper input validation
  - Create preset selection interface with customization options
  - Write unit tests for setup form validation and preset integration
  - _Requirements: 2.1, 2.2, 2.4, 7.1, 8.1, 13.2, 13.3_

- [ ] 6.3 Implement Timer Running Screen
  - Create TimerRunningScreen with large time display and progress visualization
  - Add circular progress bar around screen border and phase indicators
  - Implement round/cycle display for interval timers with color coding
  - Add click-to-pause functionality and visual feedback
  - Write unit tests for timer display updates and user interactions
  - _Requirements: 3.1, 3.2, 3.5_

- [ ] 6.4 Create Clock Screen
  - Implement ClockScreen with fullscreen time display
  - Add large, readable time formatting with responsive sizing
  - Integrate fullscreen API with proper enter/exit handling
  - Write unit tests for clock display and fullscreen functionality
  - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [ ] 6.5 Implement Settings Screen
  - Create SettingsScreen with audio controls and volume adjustment
  - Add sound pack selection with preview functionality
  - Implement settings persistence and real-time updates
  - Write unit tests for settings management and audio preview
  - _Requirements: 14.1, 14.2, 14.3, 14.4_

- [ ] 7. Add keyboard and input handling
- [ ] 7.1 Implement global keyboard shortcuts
  - Add spacebar for pause/resume functionality across all timer screens
  - Implement F/А key for fullscreen toggle with proper API integration
  - Add Escape key for modal dismissal and navigation
  - Write unit tests for keyboard event handling and screen context
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [ ] 7.2 Create mobile-friendly input controls
  - Implement touch-friendly number inputs with validation
  - Add swipe gestures for navigation where appropriate
  - Create responsive button sizing for mobile devices
  - Write unit tests for touch interactions and mobile usability
  - _Requirements: 1.3, 11.1_

- [ ] 8. Implement remote control functionality
- [ ] 8.1 Create mobile interface
  - Implement responsive mobile version of all timer screens
  - Add QR code scanning integration and connection establishment
  - Create mobile-optimized controls with touch-friendly sizing
  - Write unit tests for mobile interface functionality
  - _Requirements: 5.2, 5.3, 11.1, 11.2_

- [ ] 8.2 Add synchronization features
  - Implement real-time state synchronization between host and mobile
  - Add settings synchronization across all connected devices
  - Create autonomous mode for mobile when host disconnects
  - Write integration tests for multi-device synchronization scenarios
  - _Requirements: 5.3, 5.4, 5.5, 5.6, 14.4_

- [ ] 9. Add error handling and resilience
- [ ] 9.1 Implement error handling system
  - Create comprehensive error handling with user-friendly messages
  - Add graceful degradation for missing features (audio, WebSocket, storage)
  - Implement automatic recovery mechanisms for network issues
  - Write unit tests for error scenarios and recovery procedures
  - _Requirements: 10.3, 11.3, 11.4_

- [ ] 9.2 Add offline functionality
  - Implement offline mode with local timer functionality
  - Add service worker for caching static assets
  - Create fallback mechanisms for when services are unavailable
  - Write integration tests for offline scenarios and feature degradation
  - _Requirements: 11.3, 12.4_

- [ ] 10. Performance optimization and testing
- [ ] 10.1 Optimize timer precision and performance
  - Fine-tune timer accuracy using performance.now() and drift compensation
  - Optimize DOM updates to minimize reflow and repaint operations
  - Implement efficient state change detection and batched updates
  - Write performance tests for timer accuracy and UI responsiveness
  - _Requirements: 3.1, 3.2_

- [ ] 10.2 Add comprehensive testing suite
  - Create end-to-end tests for complete user workflows
  - Add cross-browser compatibility tests for all major browsers
  - Implement mobile device testing for responsive design
  - Write load tests for WebSocket connections and multi-device scenarios
  - _Requirements: 11.1, 11.2, 11.4_

- [ ] 11. Final integration and deployment preparation
- [ ] 11.1 Integrate all components
  - Connect all screens, services, and timers through the application core
  - Verify complete user workflows from setup to timer completion
  - Test all keyboard shortcuts and mobile interactions
  - Validate settings persistence and state synchronization
  - _Requirements: 1.1, 1.2, 2.3, 3.5, 4.1, 5.3_

- [ ] 11.2 Prepare production build
  - Configure build pipeline with asset optimization and minification
  - Set up environment-specific configurations for development and production
  - Create deployment scripts and server configuration
  - Validate production build functionality and performance
  - _Requirements: 10.1, 11.4_