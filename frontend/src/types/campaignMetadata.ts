export interface CampaignMetadata {
  id: number;
  title: string;
  category: "Pendidikan" | "Medis & Kesehatan" | "Bencana Alam" | "Panti Asuhan" | "Sarana Ibadah" | "Sosial";
  organizerName: string;
  story: string;
  imageUrl: string;
  targetUse: string[];
}

export interface DonorPrayer {
  id: string;
  campaignId: number;
  donorName: string;
  amountRupiah: string;
  prayer: string;
  timestamp: number;
}

// Data kurasi default untuk kampanye awal di blockchain
export const DEFAULT_CAMPAIGN_STORIES: Record<number, CampaignMetadata> = {
  1: {
    id: 1,
    title: "Bantuan Renovasi Ruang Kelas Madrasah Pelosok",
    category: "Pendidikan",
    organizerName: "Yayasan Peduli Generasi Bangsa",
    story: "Kondisi atap dan lantai dua ruang kelas madrasah di daerah pelosok ini sudah lapuk dan membahayakan 65 siswa yang belajar setiap hari. Melalui penggalangan donasi escrow ini, dana dikumpulkan dan dialokasikan bertahap berdasarkan tiga tahapan kerja nyata: pembelian material awal, pengerjaan konstruksi atap, hingga pengadaan meja belajar layak.",
    imageUrl: "https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=800&auto=format&fit=crop&q=80",
    targetUse: [
      "Pembelian semen, pasir, dan baja ringan atap",
      "Upah tukang dan pengerjaan konstruksi fisik",
      "Penyediaan 30 pasang meja dan kursi belajar baru",
    ],
  },
};

export const DEFAULT_PRAYERS: DonorPrayer[] = [
  {
    id: "p1",
    campaignId: 1,
    donorName: "Donatur A",
    amountRupiah: "Rp 30.000.000",
    prayer: "Semoga proses renovasi berjalan lancar dan adik-adik bisa belajar dengan aman dan nyaman.",
    timestamp: Date.now() - 3600000 * 5,
  },
  {
    id: "p2",
    campaignId: 1,
    donorName: "Hamba Allah",
    amountRupiah: "Rp 20.000.000",
    prayer: "Bismillah, semoga berkah untuk semua pihak yang terlibat dalam proyek pendidikan ini.",
    timestamp: Date.now() - 3600000 * 2,
  },
];

const STORAGE_KEY = "amanahbisa_custom_campaign_metadata";

export function getCustomCampaignMap(): Record<number, CampaignMetadata> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveCustomCampaignMetadata(meta: CampaignMetadata): void {
  if (typeof window === "undefined") return;
  try {
    const current = getCustomCampaignMap();
    current[meta.id] = meta;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch (e) {
    console.error("Gagal menyimpan metadata kampanye:", e);
  }
}

export function getCampaignMetadata(id: number): CampaignMetadata {
  const customMap = getCustomCampaignMap();
  if (customMap[id]) return customMap[id];
  if (DEFAULT_CAMPAIGN_STORIES[id]) return DEFAULT_CAMPAIGN_STORIES[id];
  return {
    id,
    title: `Kampanye Proyek Sosial #${id}`,
    category: "Sosial",
    organizerName: "Yayasan Peduli",
    story: "Penggalangan dana amanah dengan pengawasan verifikator independen dan pencairan bertahap escrow.",
    imageUrl: "https://images.unsplash.com/photo-1593113598332-cd288d649433?w=800&auto=format&fit=crop&q=80",
    targetUse: ["Tahap 1: Persiapan", "Tahap 2: Pelaksanaan", "Tahap 3: Penyelesaian"],
  };
}

