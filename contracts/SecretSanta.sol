pragma solidity ^0.8.24;

import { FHE, euint32, externalEuint32 } from "@fhevm/solidity/lib/FHE.sol";
import { ZamaEthereumConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

contract SecretSantaZama is ZamaEthereumConfig {
    struct Participant {
        address addr;
        euint32 encryptedAssignment;
        bool exists;
    }

    struct AssignmentProof {
        bytes encryptedProof;
        bytes assignmentProof;
    }

    mapping(address => Participant) public participants;
    address[] public participantList;
    mapping(address => bool) public hasRevealed;

    event ParticipantJoined(address indexed participant);
    event AssignmentRevealed(address indexed participant, uint32 assignmentIndex);
    event AssignmentVerified(address indexed participant, uint32 assignmentIndex);

    constructor() ZamaEthereumConfig() {}

    function joinSecretSanta(externalEuint32 encryptedAssignment, bytes calldata inputProof)
        external
    {
        require(!participants[msg.sender].exists, "Participant already exists");
        require(
            FHE.isInitialized(FHE.fromExternal(encryptedAssignment, inputProof)),
            "Invalid encrypted input"
        );

        participants[msg.sender] = Participant({
            addr: msg.sender,
            encryptedAssignment: FHE.fromExternal(encryptedAssignment, inputProof),
            exists: true
        });
        participantList.push(msg.sender);

        FHE.allowThis(participants[msg.sender].encryptedAssignment);
        FHE.makePubliclyDecryptable(participants[msg.sender].encryptedAssignment);

        emit ParticipantJoined(msg.sender);
    }

    function revealAssignment(
        uint32 assignmentIndex,
        bytes calldata encryptedProof,
        bytes calldata assignmentProof
    ) external {
        require(participants[msg.sender].exists, "Participant does not exist");
        require(!hasRevealed[msg.sender], "Assignment already revealed");

        AssignmentProof memory proof = AssignmentProof({
            encryptedProof: encryptedProof,
            assignmentProof: assignmentProof
        });

        _verifyAssignmentProof(msg.sender, assignmentIndex, proof);

        hasRevealed[msg.sender] = true;
        emit AssignmentRevealed(msg.sender, assignmentIndex);
    }

    function verifyAssignment(
        address participant,
        uint32 assignmentIndex,
        bytes calldata encryptedProof,
        bytes calldata assignmentProof
    ) external {
        require(participants[participant].exists, "Participant does not exist");
        require(!hasRevealed[participant], "Assignment already revealed");

        AssignmentProof memory proof = AssignmentProof({
            encryptedProof: encryptedProof,
            assignmentProof: assignmentProof
        });

        _verifyAssignmentProof(participant, assignmentIndex, proof);

        hasRevealed[participant] = true;
        emit AssignmentVerified(participant, assignmentIndex);
    }

    function getEncryptedAssignment(address participant)
        external
        view
        returns (euint32)
    {
        require(participants[participant].exists, "Participant does not exist");
        return participants[participant].encryptedAssignment;
    }

    function getParticipantCount() external view returns (uint256) {
        return participantList.length;
    }

    function _verifyAssignmentProof(
        address participant,
        uint32 assignmentIndex,
        AssignmentProof memory proof
    ) private view {
        bytes32[] memory cts = new bytes32[](1);
        cts[0] = FHE.toBytes32(participants[participant].encryptedAssignment);

        bytes memory abiEncoded = abi.encode(assignmentIndex);
        FHE.checkSignatures(cts, abiEncoded, proof.assignmentProof);
    }
}

