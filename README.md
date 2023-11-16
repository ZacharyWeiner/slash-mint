# Bitcoin Lock Tracker and Ordinal Minting Node.js Application

## Overview
This Node.js application subscribes to JungleBus to monitor new "Lock" records on the Bitcoin network. It stores these records in a Firebase database and can mint an Ordinal (a unique type of digital artifact on the Bitcoin blockchain) in response to specific slash-command messages associated with a lock.

## Features
- **Lock Monitoring:** Tracks new "Lock" records on Bitcoin via JungleBus subscription.
- **Firebase Integration:** Stores and retrieves data from a Firebase database.
- **Ordinal Minting:** Mints an Ordinal in response to specific slash commands.
- **Environment Configuration:** Uses `.env` file for sensitive configuration.

## Prerequisites
- Node.js installed.
- Firebase account and a configured Firebase project.
- JungleBus subscription key for monitoring the Bitcoin network.

## Installation
1. Clone the repository:
   `git clone [repository URL]`
2. Navigate to the project directory:
   `cd [project directory]`
3. Install dependencies:
   `npm install`

## Configuration
1. Create a `.env` file in the root of your project.
2. Add the following environment variables:
   - `GORILLA_POOL_SUBSCRIPTION_KEY`: Your JungleBus subscription key.
   - `PAYMENT_PRIVATE_KEY`: Private key for payment transactions.
   - `PAYMENT_CHANGE_ADDRESS`: Bitcoin address for receiving change.

## Usage
Run the application:
`node [main file name]`

## Functionality
- The application listens for new "Lock" records on the Bitcoin network.
- Upon detecting a lock, it processes the transaction and stores relevant information in Firebase.
- If a slash-command is detected, it triggers the minting of an Ordinal.
- Minted Ordinals are unique digital artifacts recorded on the Bitcoin blockchain.

## Contributing
Contributions are welcome. Please open an issue first to discuss what you would like to change or add.

## License
Specify your project's license here (if applicable).

---

*Note: Replace placeholders like `[repository URL]`, `[project directory]`, and `[main file name]` with actual values relevant to your project.*
