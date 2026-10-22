# Deployment Record

Tabel 1 Informasi deployment

| Item | Nilai |
|---|---|
| Waktu | 2026-10-22T23:05:05.591Z |
| Jaringan | localhost |
| Chain ID | 31337 |
| Kontrak | DonationEscrow |
| Alamat kontrak | 0x5FbDB2315678afecb367f032d93F642f64180aa3 |
| Transaksi deployment | 0x6c040fed2b3b5020d75ffadcad209d9fa526258f0740bc5e469d46f2f8836846 |
| Blok | 1 |
| Gas terpakai | 2646629 |

Tabel 2 Akun uji tanpa private key

| Peran | Alamat |
|---|---|
| regulator | 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 |
| organizer | 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 |
| verifier | 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC |
| verifier2 | 0x90F79bf6EB2c4f870365E785982E1f101E93b906 |
| pelaksana | 0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65 |

Tabel 3 Penyiapan peran

| Langkah | Hash transaksi | Blok |
|---|---|---|
| setOrganizerApproval organizer | 0x22d26382721c3a6c30afd265541435a1bfb8f52c022ecae01b002d505e6e279c | 2 |
| setVerifierApproval verifier | 0x4cbd1d20f46494b737d96a539baa88d5f786ca238dbbf40a8babd8a88e827e87 | 3 |
| setVerifierApproval verifier2 | 0x2a84d3a7ef1434e6c1891fb2ad285ee1a6888aae2629b175f33b855999e767a8 | 4 |

Tabel 4 Transaksi alur end-to-end

| No | Langkah | Hash transaksi | Blok | Gas | Event |
|---|---|---|---|---|---|
| 1 | createCampaign | 0xb542ed92d176c7cfb8f804e3d9ffcc828927bbe1748d26e8e6794ceef45ee067 | 5 | 263045 | CampaignCreated, CampaignTerms |
| 2 | donate donorA 0.6 | 0xd5b1e1b71d8fc986e846a2ffd9e0468faf2d03fe64ca2f4feabb24f54ecb166f | 6 | 72574 | Donated |
| 3 | donate donorB 0.4 | 0x99ccb44bdb875c4c26a6077cb5dbddecbfab072e67f4ffb3fa6ffb803288d962 | 7 | 55474 | Donated |
| 4 | finalizeFunding | 0x2fc75b2a5431c5956cf7b8af3a34851ba53890259ec04d454e17bb907e98caa0 | 8 | 32929 | FundingFinalized |
| 5 | submitEvidence milestone 0 | 0xaf0291c028818cabfa24d60699b150054d5901526a2c0c273083db3568c574e4 | 9 | 58487 | EvidenceSubmitted |
| 6 | approveMilestone milestone 0 | 0x504b07beeb5e89efa2d85ce6f75dbdb815c14244f987d7a2717bd7226448afcf | 10 | 37745 | MilestoneApproved |
| 7 | release milestone 0 | 0xa06c1812551c00dcb3e730e673324b3fa5c091c4cfe7498f7e88005ebd93496e | 12 | 108400 | MilestoneReleased |
| 8 | withdraw pelaksana | 0x1269b6b45cc65e830c604bd75528e552c71fa60fe9c59bf345e41b0099fdaafa | 13 | 34624 | Withdrawn |

Tabel 5 State yang diverifikasi

| Item | Nilai |
|---|---|
| idKampanye | 1 |
| saldoKontrakSetelahDonasiWei | 1000000000000000000 |
| statusKampanyeSetelahFinalisasi | 1 |
| statusMilestone0SebelumRelease | 2 |
| claimableOrganizerWei | 15000000000000000 |
| claimablePelaksanaWei | 285000000000000000 |
| saldoKontrakAkhirWei | 715000000000000000 |
| panggilanTidakSahDitolakDengan | NotRegulator() |

Langkah reproduksi

1. Terminal 1: npm run node
2. Terminal 2: npm run deploy:local
3. Terminal 2: npm run demo:local
4. Terminal 2: npm run record
