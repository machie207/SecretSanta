# Encrypted Secret Santa 🎁

Encrypted Secret Santa is a unique and playful application designed to facilitate fully random and confidential gift pairings for the holiday season. Harnessing the power of Zama's Fully Homomorphic Encryption (FHE) technology, this app ensures that even the organizer remains oblivious to who is gifting whom, thus making the experience private and secure.

## The Problem

The joy of participating in a Secret Santa event can be clouded by privacy concerns. When gift pairings are arranged in cleartext, sensitive information may be exposed, such as who is gifting whom, potentially leading to unwanted surprises or compromise of anonymity. Ensuring the secrecy of the participants and their gift choices is paramount. Conventional methods can lead to data leaks and breaches, which undermine the spirit of the event.

## The Zama FHE Solution

Using Zama's Fully Homomorphic Encryption, we can execute computations on encrypted data without needing to decrypt it first. This means that all matching logic runs on encrypted inputs, guaranteeing that sensitive information remains private and secure throughout the entire process. With tools such as fhevm, the application can process encrypted gift pairings while retaining the confidentiality of participants' identities and preferences.

## Key Features

- 🎉 **Anonymous Pairing**: All matches are conducted without revealing any names to the organizer or other participants.
- 🔒 **Secure Computation**: Utilizing Zama’s FHE technology for privacy-preserving computations ensures data remains confidential.
- 🎲 **Randomized Selection**: Employing on-chain randomness to guarantee fair and truly random gift assignments.
- ✨ **User-Friendly Animation**: Enjoy engaging animations that bring excitement to the gift reveal process.
- 🤝 **Social Interaction**: Foster a fun, warm atmosphere during the holiday season, all while maintaining privacy.

## Technical Architecture & Stack

The application is primarily powered by Zama technologies that form the core of its privacy engine:

- **Backend**: fhevm for processing encrypted data
- **Frontend**: React (or your favorite frontend library) for a responsive user interface
- **Data Storage**: IPFS for decentralized file storage (if applicable)
- **Randomness Source**: On-chain randomness generation

## Smart Contract / Core Logic

Here’s a pseudo-code snippet illustrating how the pairing logic might be implemented using Zama technologies:

```solidity
pragma solidity ^0.8.0;

import "TFHE.sol";

contract SecretSanta {
    struct Participant {
        uint64 id;
        string encryptedGiftPreference;
    }

    mapping(uint64 => Participant) public participants;

    function pairGifts(uint64 participantId1, uint64 participantId2) public {
        // Encrypt gift preferences
        uint64 encryptedPreference1 = TFHE.encrypt(participants[participantId1].encryptedGiftPreference);
        uint64 encryptedPreference2 = TFHE.encrypt(participants[participantId2].encryptedGiftPreference);

        // Execute pairing logic on encrypted data
        uint64 matchResult = TFHE.pair(encryptedPreference1, encryptedPreference2);
        
        // Decrypt results if needed
        string memory decryptedResult = TFHE.decrypt(matchResult);
        
        // Emit event or store results securely
    }
}
```

## Directory Structure

```plaintext
EncryptedSecretSanta/
├── contracts/
│   └── SecretSanta.sol
├── src/
│   ├── App.js
│   ├── components/
│   │   └── RandomPairingAnimation.js
│   ├── utils/
│   │   └── RandomNumberGenerator.js
│   └── styles/
│       └── App.css
├── scripts/
│   └── deploy.js
├── README.md
└── package.json
```

## Installation & Setup

### Prerequisites

To get started, ensure you have the following installed:

- **Node.js** (for frontend and smart contract development)
- **npm** (Node package manager)
- **Python** (if you opt for any backend services)
- Zama libraries: Make sure to install the required libraries for encryption.

### Install Dependencies

To set up the project, navigate to your project directory and run the following commands:

```bash
npm install
npm install fhevm
```

For any Python dependencies (if applicable):

```bash
pip install concrete-ml
```

## Build & Run

To compile and run your application, use the following commands:

### For Smart Contracts

```bash
npx hardhat compile
npx hardhat run scripts/deploy.js
```

### For Frontend Application

```bash
npm start
```

### For Python Backend (if applicable)

```bash
python main.py
```

## Acknowledgements

We would like to extend our heartfelt thanks to Zama for providing the open-source Fully Homomorphic Encryption primitives that make this project possible. Their innovative technology is the backbone of our application, enabling us to prioritize privacy and security in a fun and engaging way. 

---

We hope you enjoy using Encrypted Secret Santa as much as we enjoyed building it. Join us in celebrating the holidays with the delightful spirit of giving while keeping it secret and secure!

