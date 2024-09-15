# Universal Clipboard Manager

Universal Clipboard Manager is a real-time, cross-device clipboard synchronization tool. It allows users to share clipboard content seamlessly across multiple devices, enhancing productivity and ease of use.

## Features

- Real-time clipboard synchronization across devices
- Secure user authentication
- Device management
- Clipboard history tracking
- WebSocket-based real-time updates
- Responsive design for various screen sizes

## Tech Stack

- Frontend: React.js with Tailwind CSS
- Backend: Node.js with Express
- Database: Supabase
- Real-time Communication: WebSockets
- Authentication: Supabase Auth

## Getting Started

### Prerequisites

- Node.js (v14 or later)
- npm
- Supabase account

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

The server will start on `http://localhost:3000` and the client on `http://localhost:3006`.

## Usage

1. Register or log in to your account.
2. Grant necessary permissions for clipboard access.
3. Start copying and pasting across your devices!

## Deployment

1. Build the client:
   ```
   npm run build
   ```

2. Start the production server:
   ```
   npm run start:prod
   ```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Supabase](https://supabase.io/) for the backend and authentication services
- [Tailwind CSS](https://tailwindcss.com/) for the UI components
- [shadcn/ui](https://ui.shadcn.com/) for additional UI components