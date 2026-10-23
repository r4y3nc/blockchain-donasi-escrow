import sys
import os
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    PageBreak,
    KeepTogether,
    HRFlowable,
)
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super(NumberedCanvas, self).__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_number(num_pages)
            canvas.Canvas.showPage(self)
        canvas.Canvas.save(self)

    def draw_page_number(self, page_count):
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748b"))
        
        # Header (mulai halaman 2)
        if self._pageNumber > 1:
            self.drawString(
                2 * cm,
                28.2 * cm,
                "DonationEscrow DApp: Dokumentasi Integrasi Frontend & Smart Contract",
            )
            self.setStrokeColor(colors.HexColor("#e2e8f0"))
            self.setLineWidth(0.5)
            self.line(2 * cm, 28.0 * cm, 19 * cm, 28.0 * cm)

        # Footer
        page_str = f"Halaman {self._pageNumber} dari {page_count}"
        self.drawRightString(19 * cm, 1.2 * cm, page_str)
        self.drawString(
            2 * cm,
            1.2 * cm,
            "Dokumentasi Teknis untuk Pengembang Smart Contract (UAS Blockchain)",
        )
        self.setStrokeColor(colors.HexColor("#e2e8f0"))
        self.setLineWidth(0.5)
        self.line(2 * cm, 1.5 * cm, 19 * cm, 1.5 * cm)
        self.restoreState()

def build_pdf(filename):
    doc = SimpleDocTemplate(
        filename,
        pagesize=A4,
        leftMargin=2 * cm,
        rightMargin=2 * cm,
        topMargin=2.2 * cm,
        bottomMargin=2.2 * cm,
    )

    styles = getSampleStyleSheet()

    # Custom typography styles
    title_style = ParagraphStyle(
        "DocTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=20,
        leading=24,
        textColor=colors.HexColor("#0f172a"),
        spaceAfter=6,
    )

    subtitle_style = ParagraphStyle(
        "DocSubtitle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=11,
        leading=15,
        textColor=colors.HexColor("#0284c7"),
        spaceAfter=14,
    )

    meta_style = ParagraphStyle(
        "DocMeta",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8.5,
        leading=12,
        textColor=colors.HexColor("#475569"),
    )

    h1_style = ParagraphStyle(
        "Heading1_Custom",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=13,
        leading=17,
        textColor=colors.HexColor("#0f172a"),
        spaceBefore=14,
        spaceAfter=6,
        keepWithNext=True,
    )

    h2_style = ParagraphStyle(
        "Heading2_Custom",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=10.5,
        leading=14,
        textColor=colors.HexColor("#0369a1"),
        spaceBefore=10,
        spaceAfter=4,
        keepWithNext=True,
    )

    body_style = ParagraphStyle(
        "Body_Custom",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9,
        leading=13.5,
        textColor=colors.HexColor("#334155"),
        spaceAfter=6,
    )

    body_bold = ParagraphStyle(
        "BodyBold_Custom",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=9,
        leading=13.5,
        textColor=colors.HexColor("#1e293b"),
        spaceAfter=4,
    )

    code_style = ParagraphStyle(
        "Code_Custom",
        parent=styles["Normal"],
        fontName="Courier",
        fontSize=8,
        leading=11,
        textColor=colors.HexColor("#0f172a"),
    )

    callout_style = ParagraphStyle(
        "Callout_Custom",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8.5,
        leading=12.5,
        textColor=colors.HexColor("#0f766e"),
    )

    story = []

    # Header Dokumen
    story.append(Paragraph("DonationEscrow DApp: Panduan Integrasi Frontend", title_style))
    story.append(Paragraph("Penjelasan Arsitektur Antarmuka Pengguna untuk Pengembang Smart Contract", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#0284c7"), spaceAfter=10))

    # Meta Box
    meta_data = [
        [
            Paragraph("<b>Penyusun:</b> Tim Pengembang Frontend", meta_style),
            Paragraph("<b>Target Pembaca:</b> Rekan Pengembang Smart Contract", meta_style),
        ],
        [
            Paragraph("<b>Target Kontrak:</b> DonationEscrow.sol (v4 Audited)", meta_style),
            Paragraph("<b>Jaringan Uji:</b> Hardhat Localhost (Chain ID: 31337)", meta_style),
        ],
        [
            Paragraph("<b>Status Backend:</b> 100% Orisinal (Nol Perubahan Kode)", meta_style),
            Paragraph("<b>Status Uji:</b> 25 Test Passed (100% Sukses)", meta_style),
        ]
    ]
    t_meta = Table(meta_data, colWidths=[8.5 * cm, 8.5 * cm])
    t_meta.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ("PADDING", (0, 0), (-1, -1), 6),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.append(t_meta)
    story.append(Spacer(1, 12))

    # Bagian 1: Pesan Pembuka & Komitmen Nol Perubahan
    story.append(Paragraph("1. Prinsip Utama: Zero Backend Changes", h1_style))
    story.append(Paragraph(
        "Pertama-tama, selamat dan apresiasi penuh untuk rekan pengembang smart contract. Kontrak <b>DonationEscrow.sol (versi v4)</b> yang Anda bangun telah lolos seluruh 25 unit test audit Hardhat dengan sangat solid (mencakup proteksi reentrancy, pembagian milestone, pull payment, hingga tata kelola regulator).",
        body_style
    ))
    story.append(Paragraph(
        "Frontend dibangun dengan prinsip mutlak: <b>tidak ada satu baris pun kode smart contract (.sol) atau konfigurasi deployment yang diubah</b>. Semua fitur antarmuka modern yang ditambahkan di sisi Web3 (seperti kalkulasi hash berkas lokal, konsol bilah sisi, dan konversi Rupiah) bekerja 100% memanfaatkan fungsi-fungsi orisinal yang telah Anda sediakan.",
        body_style
    ))
    story.append(Spacer(1, 8))

    # Bagian 2: Pemetaan 5 Peran On-Chain ke Tata Letak UI
    story.append(Paragraph("2. Arsitektur Antarmuka: Pemisahan Donatur vs Konsol Pengelola", h1_style))
    story.append(Paragraph(
        "Untuk mencegah desain antarmuka yang membingungkan dengan tumpukan tab yang tidak terstruktur, antarmuka frontend secara cerdas mendeteksi status on-chain dari akun yang sedang terhubung melalui Web3Context:",
        body_style
    ))

    role_table_data = [
        [
            Paragraph("<b>Peran On-Chain</b>", body_bold),
            Paragraph("<b>Pemeriksaan Kontrak / Alamat</b>", body_bold),
            Paragraph("<b>Tampilan Antarmuka Frontend</b>", body_bold),
        ],
        [
            Paragraph("<b>Donatur Publik</b><br/><font color='#64748b' size='7'>0x9965...A4dc</font>", body_style),
            Paragraph("Akun masyarakat biasa (bukan regulator, organizer, verifier, atau executor).", body_style),
            Paragraph("<b>Portal Publik Crowdfunding:</b> Hero banner, filter kategori donasi, katalog kampanye, doa donatur, dan tab Donasi Saya.", body_style),
        ],
        [
            Paragraph("<b>Penyelenggara</b><br/><font color='#64748b' size='7'>0x7099...79C8</font>", body_style),
            Paragraph("<code>approvedOrganizers(account) == true</code>", body_style),
            Paragraph("<b>Konsol Sidebar:</b> Program Yayasan, Buka Penggalangan Baru (modal & form), dan penarikan biaya operasional.", body_style),
        ],
        [
            Paragraph("<b>Verifikator</b><br/><font color='#64748b' size='7'>0x3C44...93BC</font>", body_style),
            Paragraph("<code>approvedVerifiers(account) == true</code>", body_style),
            Paragraph("<b>Konsol Sidebar:</b> Antrean Verifikasi dengan badge hitungan bukti masuk, tombol Setujui dan Tolak bukti.", body_style),
        ],
        [
            Paragraph("<b>Pelaksana</b><br/><font color='#64748b' size='7'>0x15d3...6A65</font>", body_style),
            Paragraph("<code>c.executor == account</code> pada salah satu kampanye.", body_style),
            Paragraph("<b>Konsol Sidebar:</b> Tugas Unggah Bukti Lapangan dengan pemilih berkas Keccak-256 dan penarikan dana termin.", body_style),
        ],
        [
            Paragraph("<b>Regulator</b><br/><font color='#64748b' size='7'>0xf39F...2266</font>", body_style),
            Paragraph("<code>regulator() == account</code>", body_style),
            Paragraph("<b>Konsol Sidebar:</b> Panel Pengawasan & Eskalasi, audit darurat, dan penyelesaian sengketa milestone.", body_style),
        ],
    ]
    t_roles = Table(role_table_data, colWidths=[4.2 * cm, 4.8 * cm, 8.0 * cm])
    t_roles.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e0f2fe")),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ("PADDING", (0, 0), (-1, -1), 5),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    story.append(t_roles)
    story.append(Spacer(1, 10))

    # Callout info mode tinjau
    callout_data = [[
        Paragraph("<b>Catatan Integrasi:</b> Pengelola operasional (Penyelenggara, Verifikator, Pelaksana, Regulator) tetap memiliki tombol <i>'Buka Portal Donatur'</i> di bilah sisi jika ingin meninjau tampilan publik dari sudut pandang masyarakat umum.", callout_style)
    ]]
    t_callout = Table(callout_data, colWidths=[17.0 * cm])
    t_callout.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f0fdfa")),
        ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#0d9488")),
        ("PADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(t_callout)

    story.append(PageBreak())

    # Bagian 3: Hashing Client-Side (Keccak-256)
    story.append(Paragraph("3. Mekanisme Unggah Berkas & Hashing Client-Side", h1_style))
    story.append(Paragraph(
        "Fungsi pada kontrak Solidity Anda adalah: <br/>"
        "<code>function submitEvidence(uint256 id, uint8 m, bytes32 evidenceHash) external</code>",
        code_style
    ))
    story.append(Spacer(1, 6))
    story.append(Paragraph(
        "Kontrak Anda secara sangat tepat hanya meminta parameter bertipe <b>bytes32</b>. Frontend memanfaatkan arsitektur ini dengan menghitung sidik jari kriptografi secara langsung di peramban:",
        body_style
    ))

    hash_steps_data = [
        [
            Paragraph("<b>Langkah 1: Pemilihan Berkas Fisik</b>", body_bold),
            Paragraph("Pelaksana Lapangan memilih berkas nyata dari laptopnya (foto kuitansi, nota belanja material, atau laporan progres PDF) melalui elemen <code>&lt;input type='file'&gt;</code>.", body_style)
        ],
        [
            Paragraph("<b>Langkah 2: Pembacaan Byte Array</b>", body_bold),
            Paragraph("Modul frontend (<code>frontend/src/utils/hashHelper.ts</code>) membaca berkas sebagai <code>ArrayBuffer</code> lalu mengonversinya menjadi <code>Uint8Array</code> tanpa mengirim berkas ke server manapun.", body_style)
        ],
        [
            Paragraph("<b>Langkah 3: Komputasi Keccak-256</b>", body_bold),
            Paragraph("Frontend menjalankan <code>ethers.keccak256(uint8Array)</code> menghasilkan string heksadesimal 32-byte (contoh: <code>0x7f83b1657ff1...</code>) dan mengisi otomatis form input.", body_style)
        ],
        [
            Paragraph("<b>Langkah 4: Pengiriman On-Chain</b>", body_bold),
            Paragraph("Saat tombol 'Kirim Bukti ke Kontrak' diklik, hash tersebut langsung dikirimkan ke parameter <code>evidenceHash</code> pada kontrak Anda.", body_style)
        ]
    ]
    t_hash = Table(hash_steps_data, colWidths=[5.5 * cm, 11.5 * cm])
    t_hash.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#f8fafc")),
        ("PADDING", (0, 0), (-1, -1), 6),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    story.append(t_hash)
    story.append(Spacer(1, 10))

    # Keunggulan arsitektur
    story.append(Paragraph("Keuntungan Nyata dari Pendekatan Ini:", body_bold))
    story.append(Paragraph(
        "• <b>Efisiensi Biaya Gas:</b> Menyimpan berkas fisik di blockchain biayanya sangat besar. Menyimpan hash 32-byte hanya membutuhkan ~25.000 gas.<br/>"
        "• <b>Zero-PII & Kepatuhan Privasi:</b> Identitas sensitif pada foto dan kuitansi tidak bocor ke publik blockchain, namun integritasnya terkunci secara permanen dan tidak dapat dimanipulasi.",
        body_style
    ))
    story.append(Spacer(1, 8))

    # Bagian 4: Pemetaan Siklus Hidup Smart Contract ke UI
    story.append(Paragraph("4. Pemetaan Siklus Hidup (Lifecycle) ke Alur Kerja UI", h1_style))
    story.append(Paragraph(
        "Berikut adalah cara frontend menjembatani alur logika state machine smart contract agar pengguna tidak mengalami kebingungan (*revert error*):",
        body_style
    ))

    lifecycle_data = [
        [
            Paragraph("<b>Tahap Siklus</b>", body_bold),
            Paragraph("<b>Fungsi Smart Contract</b>", body_bold),
            Paragraph("<b>Perilaku & Tampilan di Frontend</b>", body_bold),
        ],
        [
            Paragraph("<b>1. Penggalangan Dana</b><br/><font color='#64748b' size='7'>CampaignStatus.Funding</font>", body_style),
            Paragraph("<code>donate(id)</code><br/><i>payable</i>", code_style),
            Paragraph("Donatur menyalurkan dana dengan konversi Rupiah instan (1 ETH = Rp 45.000.000). Milestone berstatus 'Menunggu' dan tugas pelaksana belum dibuka untuk mencegah pengerjaan dini.", body_style),
        ],
        [
            Paragraph("<b>2. Finalisasi Target</b><br/><font color='#64748b' size='7'>Funding -> Active</font>", body_style),
            Paragraph("<code>finalizeFunding(id)</code>", code_style),
            Paragraph("Saat total terkumpul mencapai 100% target, tombol <i>'⚡ Target Tercapai! Klik untuk Finalisasi'</i> otomatis muncul di modal untuk mengubah status kampanye menjadi Active.", body_style),
        ],
        [
            Paragraph("<b>3. Pengerjaan Milestone</b><br/><font color='#64748b' size='7'>Milestone: Submitted</font>", body_style),
            Paragraph("<code>submitEvidence(id, m, hash)</code>", code_style),
            Paragraph("Kampanye otomatis masuk ke menu bilah sisi Pelaksana (<i>Tugas Unggah Bukti</i>) untuk kalkulasi berkas fisik dan pencatatan hash ke blockchain.", body_style),
        ],
        [
            Paragraph("<b>4. Audit Independen</b><br/><font color='#64748b' size='7'>Milestone: Approved</font>", body_style),
            Paragraph("<code>approveMilestone(id, m)</code><br/><code>rejectMilestone(id, m, code)</code>", code_style),
            Paragraph("Kampanye otomatis muncul di menu bilah sisi Verifikator (<i>Antrean Verifikasi</i>) dengan opsi Setujui atau Tolak disertai pilihan kode alasan penolakan.", body_style),
        ],
        [
            Paragraph("<b>5. Masa Sanggahan</b><br/><font color='#64748b' size='7'>challengeWindow = 2 days</font>", body_style),
            Paragraph("Proteksi internal kontrak:<br/><code>revert ChallengeWindowOpen()</code>", code_style),
            Paragraph("Status milestone menampilkan 'Disetujui (Masa Sanggahan)'. Tersedia tombol pintas demo <i>'⏩ Majukan Waktu Node 2 Hari'</i> untuk melewati masa tunggu secara instan di Hardhat.", body_style),
        ],
        [
            Paragraph("<b>6. Pelepasan Dana</b><br/><font color='#64748b' size='7'>Milestone: Released</font>", body_style),
            Paragraph("<code>release(id, m)</code>", code_style),
            Paragraph("Dana milestone dilepaskan dari escrow dan ditampung ke saldo hak tarik (<code>claimable</code>) pelaksana (anggaran fisik) dan yayasan (biaya operasional).", body_style),
        ],
        [
            Paragraph("<b>7. Penarikan Saldo</b><br/><font color='#64748b' size='7'>Pull Payment</font>", body_style),
            Paragraph("<code>withdraw()</code>", code_style),
            Paragraph("Pelaksana dan Penyelenggara dapat mencairkan dana bersih ke dompet Web3 pribadi mereka melalui kartu 'Saldo & Klaim Escrow' dengan 1 klik.", body_style),
        ],
    ]
    t_life = Table(lifecycle_data, colWidths=[4.2 * cm, 4.8 * cm, 8.0 * cm])
    t_life.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ("PADDING", (0, 0), (-1, -1), 4.5),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    story.append(t_life)

    story.append(PageBreak())

    # Bagian 5: Fitur Alat Bantu Pengujian (Demo Helpers)
    story.append(Paragraph("5. Fitur Pintas Pengujian untuk Presentasi & Ujian (Demo Helpers)", h1_style))
    story.append(Paragraph(
        "Untuk memudahkan demonstrasi di hadapan dosen penguji tanpa harus menunggu transaksi manual yang lama atau menunggu jeda waktu blockchain riil, frontend dilengkapi dengan fitur bantuan pengujian khusus:",
        body_style
    ))

    helpers_data = [
        [
            Paragraph("<b>Fitur Demo Frontend</b>", body_bold),
            Paragraph("<b>Mekanisme Teknis</b>", body_bold),
            Paragraph("<b>Manfaat Saat Presentasi Ujian</b>", body_bold),
        ],
        [
            Paragraph("<b>Modal Akun Simulasi Cepat</b>", body_style),
            Paragraph("Beralih signer antar 5 akun bawaan Hardhat (Signer #0 sampai #4) tanpa perlu konfigurasi private key MetaMask.", body_style),
            Paragraph("Dosen dapat langsung melihat perbedaan wewenang antara Donatur, Penyelenggara, Verifikator, Pelaksana, dan Regulator dalam hitungan detik.", body_style),
        ],
        [
            Paragraph("<b>Tombol 'Penuhi Sisa Target'</b>", body_style),
            Paragraph("Menghitung selisih <code>target - totalRaised</code> dan mengisi formulir donasi seketika.", body_style),
            Paragraph("Mempercepat simulasi penggalangan dana dari 0% langsung ke 100% sehingga tahap pengerjaan fisik dapat segera diuji.", body_style),
        ],
        [
            Paragraph("<b>Bypass Masa Sanggahan 2 Hari</b>", body_style),
            Paragraph("Memanggil JSON-RPC <code>evm_increaseTime(172801)</code> dan <code>evm_mine()</code> langsung ke node Hardhat.", body_style),
            Paragraph("Menjelaskan konsep Challenge Window kepada dosen sekaligus langsung mendemokan pencairan dana tahap berikutnya tanpa macet.", body_style),
        ],
    ]
    t_helpers = Table(helpers_data, colWidths=[4.5 * cm, 5.5 * cm, 7.0 * cm])
    t_helpers.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e0f2fe")),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ("PADDING", (0, 0), (-1, -1), 5),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    story.append(t_helpers)
    story.append(Spacer(1, 14))

    # Bagian 6: Panduan Singkat Menjalankan Sistem Secara Bersama
    story.append(Paragraph("6. Panduan Menjalankan Frontend & Backend Bersama", h1_style))
    story.append(Paragraph("Buka 2 jendela terminal pada direktori proyek:", body_bold))

    steps_code = [
        [
            Paragraph(
                "<b>Terminal 1 (Blockchain Hardhat Node):</b><br/>"
                "<code>npm run node</code><br/>"
                "<i>Node lokal akan berjalan di http://127.0.0.1:8545 dengan Chain ID 31337.</i>",
                body_style
            )
        ],
        [
            Paragraph(
                "<b>Terminal 2 (Deploy Kontrak & Jalankan Web App):</b><br/>"
                "<code>npm run deploy:local</code><br/>"
                "<code>cd frontend &amp;&amp; npm run dev</code><br/>"
                "<i>Aplikasi akan aktif di http://localhost:3000 dan langsung membaca artefak kontrak dari deployment/DonationEscrow.json.</i>",
                body_style
            )
        ]
    ]
    t_steps = Table(steps_code, colWidths=[17.0 * cm])
    t_steps.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#94a3b8")),
        ("PADDING", (0, 0), (-1, -1), 7),
    ]))
    story.append(t_steps)
    story.append(Spacer(1, 14))

    # Penutup
    story.append(Paragraph("7. Kesimpulan & Apresiasi Kolaborasi", h1_style))
    story.append(Paragraph(
        "Integrasi antara smart contract Solidity Anda dan frontend Web3 telah selesai dengan sempurna. Logika on-chain yang ketat dan aman kini memiliki antarmuka pengguna yang elegan, transparan, dan sangat mudah dipahami. Proyek kolaborasi ini sudah siap sepenuhnya untuk dipresentasikan dan diuji pada evaluasi akademik UAS Blockchain.",
        body_style
    ))

    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"PDF berhasil dibuat di: {filename}")

if __name__ == "__main__":
    out_path = r"d:\blockchain-donasi-escrow\DOKUMENTASI_FRONTEND_UNTUK_PENGEMBANG_BLOCKCHAIN.pdf"
    build_pdf(out_path)
