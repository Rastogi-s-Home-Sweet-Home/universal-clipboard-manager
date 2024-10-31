# Universal Clipboard Manager

Universal Clipboard Manager is a real-time, cross-device clipboard synchronization tool. It allows users to share clipboard content seamlessly across multiple devices, enhancing productivity and ease of use. The project includes both a web application and a Chrome extension for convenient access.

## Features

- Real-time clipboard synchronization across devices
- Secure user authentication
- Device management
- Clipboard history tracking
- Web Push based real-time updates
- Responsive design for various screen sizes
- Chrome extension for easy access

## Tech Stack

- Frontend: React.js with Tailwind CSS
- Backend: Node.js with Express
- Database: Supabase
- Real-time Communication: Web Push API
- Authentication: Supabase Auth
- Chrome Extension: React-based popup

## Getting Started

### Prerequisites

- Node.js (v14 or later)
- npm
- Supabase account
- Google Chrome browser (for the extension)

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/your-username/universal-clipboard-manager.git
   cd universal-clipboard-manager
   ```

2. Install dependencies for both server and client:
   ```
   npm run install-all
   ```

3. Set up environment variables:
   - Create a `.env` file in the root directory for server-side variables
   - Create a `.env` file in the `client` directory for client-side variables
   
   Use the provided `.env.example` files as templates.

4. Start the development server:
   ```
   npm run dev
   ```

### Chrome Extension Setup

1. Navigate to the extension directory:
   ```
   cd extension
   ```

2. Install extension dependencies:
   ```
   npm install
   ```

3. Build the extension:
   ```
   npm run build
   ```

4. Load the extension in Chrome:
   - Open Chrome and go to `chrome://extensions`
   - Enable "Developer mode" in the top right
   - Click "Load unpacked" and select the `extension/dist` directory

## Usage

### Web Application

1. Register or log in to your account.
2. Grant necessary permissions for clipboard access.
3. Start copying and pasting across your devices!

### Chrome Extension

1. Click on the extension icon in Chrome to open the popup.
2. Log in with your Universal Clipboard Manager account.
3. Use the popup interface to send, receive, and manage clipboard content.

## Deployment

1. Build the client:
   ```
   npm run build
   ```

2. Start the production server:
   ```
   npm run start:prod
   ```

3. For the Chrome extension, submit the built package to the Chrome Web Store.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Supabase](https://supabase.io/) for the backend and authentication services
- [Tailwind CSS](https://tailwindcss.com/) for the UI components
- [shadcn/ui](https://ui.shadcn.com/) for additional UI components
- [Chrome Extension API](https://developer.chrome.com/docs/extensions/) for extension development