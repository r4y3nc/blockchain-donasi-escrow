// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

/// @notice KONTRAK BANTU UJI (TC-16). Bukan bagian dari sistem.
/// Berperan sebagai donatur atau pelaksana, lalu mencoba masuk ulang (re-enter)
/// ke DonationEscrow saat menerima dana. Hasil percobaan dicatat untuk diperiksa test.
contract ReentrancyAttacker {
    address public immutable owner;
    address public target;
    bytes public reentryData;
    bool public reentryAttempted;
    bool public reentrySucceeded;
    uint256 public received;

    constructor() {
        owner = msg.sender;
    }

    /// @notice Mengisi saldo penyerang agar dapat berdonasi. Tidak mengubah `received`.
    function fund() external payable {}

    /// @notice Meneruskan panggilan ke kontrak lain atas nama penyerang.
    function exec(address to, uint256 value, bytes calldata data) external returns (bytes memory) {
        require(msg.sender == owner, "bukan pemilik");
        (bool ok, bytes memory ret) = to.call{value: value}(data);
        if (!ok) {
            assembly {
                revert(add(ret, 32), mload(ret))
            }
        }
        return ret;
    }

    /// @notice Menyiapkan percobaan masuk ulang berikutnya.
    function arm(address target_, bytes calldata data) external {
        require(msg.sender == owner, "bukan pemilik");
        target = target_;
        reentryData = data;
        reentryAttempted = false;
        reentrySucceeded = false;
    }

    receive() external payable {
        received += msg.value;
        if (target != address(0) && !reentryAttempted) {
            reentryAttempted = true;
            (bool ok, ) = target.call(reentryData);
            reentrySucceeded = ok;
        }
    }
}
