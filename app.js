const API_URL =
  "https://script.google.com/macros/s/AKfycbxA2jNqtpCorm_BLRj-BF0mnKJPhy6-B36zav9WMPTbkN-6g4HVPg9KhmoIiwCGf1GJ/exec";

// Elemen HTML
const btnTambah = document.getElementById("btn-tambah");
const formSection = document.getElementById("form-section");
const formKegiatan = document.getElementById("form-kegiatan");
const btnBatal = document.getElementById("btn-batal");
const daftarKegiatan = document.getElementById("daftar-kegiatan");
const btnSubmit = document.getElementById("btn-submit");
const btnDownloadWord = document.getElementById("btn-download-word");

let dataGlobalKegiatan = []; // selalu tersimpan dalam keadaan TERURUT (lihat urutkanKegiatan)
const ITEM_PER_PAGE = 5; // Batas jumlah kegiatan per halaman

// Menggunakan event 'pointerdown' agar responsif di HP (tanpa jeda 300ms)
btnTambah.addEventListener("pointerdown", function (e) {
  e.preventDefault(); // Mencegah jeda klik bawaan HP
  formSection.hidden = false;
  btnTambah.hidden = true;
});

btnBatal.addEventListener("pointerdown", function (e) {
  e.preventDefault();
  formKegiatan.reset();
  formSection.hidden = true;
  btnTambah.hidden = false;
});

// ==========================================
// PENGIRIMAN DATA (SIMPAN)
// ==========================================
formKegiatan.addEventListener("submit", function (e) {
  e.preventDefault(); 
  btnSubmit.textContent = "Memproses foto..."; // Umpan balik instan di HP
  btnSubmit.disabled = true;

  const dataForm = {
    tanggal: document.getElementById("tanggal").value,
    aktivitas: document.getElementById("aktivitas").value,
    mulai: document.getElementById("mulai").value,
    selesai: document.getElementById("selesai").value,
    action: "save" 
  };

  const fotoInput = document.getElementById("foto");
  if (fotoInput.files.length > 0) {
    const file = fotoInput.files[0];
    // objectURL (bukan FileReader/base64) agar foto asli HP yang besar
    // tidak menjadi string raksasa di memori
    const fotoUrlSementara = URL.createObjectURL(file);
    const img = new Image();

    img.onload = function() {
      const canvas = document.createElement('canvas');
      const MAX_WIDTH = 300; // Ukuran optimal untuk Word & HP
      const scaleSize = MAX_WIDTH / img.width;
      canvas.width = MAX_WIDTH;
      canvas.height = img.height * scaleSize;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
      URL.revokeObjectURL(fotoUrlSementara);

      dataForm.fotoBase64 = compressedBase64;
      dataForm.namaFoto = file.name;
      dataForm.mimeType = 'image/jpeg';

      btnSubmit.textContent = "Menyimpan ke server...";
      kirimData(dataForm);
    };

    img.onerror = function() {
      URL.revokeObjectURL(fotoUrlSementara);
      btnSubmit.textContent = "Simpan Kegiatan";
      btnSubmit.disabled = false;
      alert("Foto tidak bisa dibaca. Coba pilih foto lain.");
    };

    img.src = fotoUrlSementara; 
  } else {
    kirimData(dataForm);
  }
});

function kirimData(dataForm) {
  fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(dataForm),
  })
    .then((response) => response.json())
    .then((result) => {
      btnSubmit.textContent = "Simpan Kegiatan";
      btnSubmit.disabled = false;
      if (result.success) {
        alert("Kegiatan berhasil disimpan!");
        formKegiatan.reset();
        formSection.hidden = true;
        btnTambah.hidden = false;
        muatKegiatan();
      } else {
        alert("Gagal menyimpan: " + result.message);
      }
    })
    .catch((error) => {
      btnSubmit.textContent = "Simpan Kegiatan";
      btnSubmit.disabled = false;
      alert("Terjadi kesalahan jaringan.");
    });
}

// ==========================================
// FUNGSI MENGHAPUS KEGIATAN
// ==========================================
function hapusKegiatan(idKegiatan) {
  if (!confirm("Apakah Anda yakin ingin menghapus kegiatan ini?")) {
    return;
  }

  fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action: "delete", id: idKegiatan }),
  })
    .then((response) => response.json())
    .then((result) => {
      if (result.success) {
        alert("Kegiatan berhasil dihapus!");
        dataGlobalKegiatan = dataGlobalKegiatan.filter(function (k) {
          return String(k.id) !== String(idKegiatan);
        });
        tampilkanKegiatan(halamanSekarang);
      } else {
        alert("Gagal menghapus: " + result.message);
      }
    })
    .catch((error) => {
      alert("Terjadi kesalahan jaringan.");
    });
}

// ==========================================
// PENGURUTAN OTOMATIS (TANGGAL, LALU JAM MULAI)
// Dipakai oleh tabel di web DAN file Word.
// Kegiatan yang diinput acak akan tetap tersusun rapi.
// ==========================================
function ambilTanggalKey(item) {
  return String((item && item.tanggal) || "").split("T")[0];
}

function ambilMenitMulai(waktuStr) {
  // Mengambil jam mulai (angka pertama) dari "11:00 - 12:00" / "11.00–12.00"
  const cocok = /(\d{1,2})[:.](\d{2})/.exec(waktuStr || "");
  return cocok ? parseInt(cocok[1], 10) * 60 + parseInt(cocok[2], 10) : Infinity;
}

function urutkanKegiatan(data) {
  return data
    .map((item, i) => ({
      item: item,
      i: i,
      tgl: ambilTanggalKey(item),
      mulai: ambilMenitMulai(item.waktu),
    }))
    .sort((a, b) => {
      if (a.tgl !== b.tgl) return a.tgl < b.tgl ? -1 : 1; // 1) tanggal
      if (a.mulai !== b.mulai) return a.mulai < b.mulai ? -1 : 1; // 2) jam mulai
      return a.i - b.i; // 3) urutan masuk (jika tanggal & jam sama)
    })
    .map((x) => x.item);
}

// ==========================================
// MENAMPILKAN DATA WEB (DENGAN PAGINASI)
// ==========================================
function formatTanggal(tanggal) {
  if (!tanggal) return "-";
  const bagian = tanggal.split("-");
  if (bagian.length !== 3) return tanggal;
  return `${bagian[2]}/${bagian[1]}/${bagian[0]}`;
}

function buatSel(teks) {
  const td = document.createElement("td");
  td.textContent = teks || "-";
  return td;
}

let halamanSekarang = 1;

function tampilkanKegiatan(halamanAktif = 1) {
  daftarKegiatan.replaceChildren();

  // dataGlobalKegiatan sudah terurut saat dimuat, jadi tidak perlu diurutkan ulang
  const semuaKegiatan = dataGlobalKegiatan;

  const totalData = semuaKegiatan.length;
  const totalHalaman = Math.max(1, Math.ceil(totalData / ITEM_PER_PAGE));
  halamanSekarang = Math.min(Math.max(1, halamanAktif), totalHalaman);

  if (totalData === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 6;
    td.textContent = "Belum ada kegiatan yang tersimpan.";
    td.style.textAlign = "center";
    tr.appendChild(td);
    daftarKegiatan.appendChild(tr);
    buatTombolHalaman(0, 1);
    return;
  }

  const startIndex = (halamanSekarang - 1) * ITEM_PER_PAGE;
  const dataHalamanIni = semuaKegiatan.slice(
    startIndex,
    startIndex + ITEM_PER_PAGE,
  );

  // Baris dikumpulkan dulu, lalu dipasang sekali (lebih ringan di HP)
  const fragmen = document.createDocumentFragment();

  dataHalamanIni.forEach(function (item, index) {
    const tr = document.createElement("tr");

    const nomorUrut = startIndex + index + 1;
    tr.appendChild(buatSel(String(nomorUrut)));

    let tglDisplay = item.tanggal || "-";
    if (tglDisplay.includes("T")) {
      tglDisplay = tglDisplay.split("T")[0];
    }

    tr.appendChild(buatSel(formatTanggal(tglDisplay)));
    tr.appendChild(buatSel(item.aktivitas));
    tr.appendChild(buatSel(item.waktu));

    const tdFoto = document.createElement("td");
    if (item.fotoUrl) {
      const link = document.createElement("a");
      link.href = item.fotoUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "Lihat foto";
      tdFoto.appendChild(link);
    } else {
      tdFoto.textContent = "-";
    }
    tr.appendChild(tdFoto);

    // Pembuatan Tombol Hapus Menggunakan Class CSS
    const tdAksi = document.createElement("td");
    const btnHapus = document.createElement("button");
    btnHapus.textContent = "✖";
    btnHapus.className = "btn-hapus"; // <-- Diatur di styles.css
    btnHapus.title = "Hapus Kegiatan";
    btnHapus.onclick = function () {
      hapusKegiatan(item.id);
    };

    tdAksi.appendChild(btnHapus);
    tr.appendChild(tdAksi);
    fragmen.appendChild(tr);
  });

  daftarKegiatan.appendChild(fragmen);
  buatTombolHalaman(totalData, halamanSekarang);
}

function buatTombolHalaman(totalData, halamanAktif) {
  let wadahHalaman = document.getElementById("wadah-halaman");

  if (!wadahHalaman) {
    wadahHalaman = document.createElement("div");
    wadahHalaman.id = "wadah-halaman";
    wadahHalaman.className = "pagination-container"; // <-- Diatur di styles.css
    daftarKegiatan.parentElement.insertAdjacentElement(
      "afterend",
      wadahHalaman,
    );
  }

  wadahHalaman.replaceChildren();

  const totalHalaman = Math.ceil(totalData / ITEM_PER_PAGE);
  if (totalHalaman <= 1) return;

  function buatTombol(teks, tujuan, nonaktif = false, aktif = false) {
    const tombol = document.createElement("button");
    tombol.type = "button";
    tombol.textContent = teks;
    tombol.disabled = nonaktif;
    tombol.className = "page-btn"; // <-- Diatur di styles.css

    if (aktif) tombol.classList.add("active");

    tombol.addEventListener("click", function () {
      if (!nonaktif) tampilkanKegiatan(tujuan);
    });

    wadahHalaman.appendChild(tombol);
  }

  buatTombol("‹ Sebelumnya", halamanAktif - 1, halamanAktif === 1);

  for (let i = 1; i <= totalHalaman; i++) {
    buatTombol(String(i), i, false, i === halamanAktif);
  }

  buatTombol("Berikutnya ›", halamanAktif + 1, halamanAktif === totalHalaman);

  const info = document.createElement("div");
  const awal = (halamanAktif - 1) * ITEM_PER_PAGE + 1;
  const akhir = Math.min(halamanAktif * ITEM_PER_PAGE, totalData);

  info.textContent = `Menampilkan ${awal}–${akhir} dari ${totalData} kegiatan | Halaman ${halamanAktif} dari ${totalHalaman}`;
  info.className = "page-info"; // <-- Diatur di styles.css

  wadahHalaman.appendChild(info);
}

function tampilkanPesanTabel(teks) {
  if (dataGlobalKegiatan.length > 0) return; // jangan hapus daftar yang sudah tampil
  daftarKegiatan.replaceChildren();
  const tr = document.createElement("tr");
  const td = document.createElement("td");
  td.colSpan = 6;
  td.textContent = teks;
  td.style.textAlign = "center";
  tr.appendChild(td);
  daftarKegiatan.appendChild(tr);
}

function muatKegiatan() {
  const callbackName = "kodeLookbookCallback_" + Date.now();
  const script = document.createElement("script");
  const timeout = setTimeout(function () {
    bersihkan();
    console.error("Waktu pemuatan kegiatan habis.");
    tampilkanPesanTabel("Memuat data terlalu lama. Muat ulang halaman.");
  }, 45000);

  function bersihkan() {
    clearTimeout(timeout);
    delete window[callbackName];
    script.remove();
  }

  window[callbackName] = function (hasil) {
    bersihkan();
    if (hasil && hasil.success) {
      // Diurutkan SEKALI di sini: tanggal -> jam mulai
      dataGlobalKegiatan = urutkanKegiatan(
        Array.isArray(hasil.data) ? hasil.data : [],
      );
      tampilkanKegiatan(1);
    } else {
      console.error(
        "Gagal memuat kegiatan:",
        hasil?.message || "Respons tidak valid.",
      );
    }
  };

  script.onerror = function () {
    bersihkan();
    console.error("Gagal menghubungi Google Sheets.");
    tampilkanPesanTabel("Gagal memuat data. Periksa koneksi lalu muat ulang.");
  };

  script.src =
    API_URL + "?action=list&callback=" + encodeURIComponent(callbackName);
  document.body.appendChild(script);
}

// ==========================================
// PERMINTAAN JSONP (PROMISE) - dipakai untuk mengambil foto saat download Word
// ==========================================
function jsonpRequest(query, timeoutMs) {
  return new Promise(function (resolve, reject) {
    const callbackName =
      "kodeFoto_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
    const script = document.createElement("script");
    const timer = setTimeout(function () {
      bersih();
      reject(new Error("Waktu habis."));
    }, timeoutMs);

    function bersih() {
      clearTimeout(timer);
      delete window[callbackName];
      script.remove();
    }

    window[callbackName] = function (hasil) {
      bersih();
      resolve(hasil);
    };
    script.onerror = function () {
      bersih();
      reject(new Error("Gagal menghubungi server."));
    };
    script.src =
      API_URL + "?" + query + "&callback=" + encodeURIComponent(callbackName);
    document.body.appendChild(script);
  });
}

// ==========================================
// LOGIKA DOWNLOAD KE WORD (PENGATURAN GAMBAR 30mm)
// ==========================================
function formatTanggalWord(tanggalStr) {
  if (!tanggalStr) return "-";
  let d = tanggalStr.includes("T")
    ? new Date(tanggalStr.split("T")[0])
    : new Date(tanggalStr);
  if (isNaN(d.getTime())) return tanggalStr;
  const hari = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const bulan = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
  ];
  return `${hari[d.getDay()]},<br>${d.getDate()} ${bulan[d.getMonth()]} ${d.getFullYear()}`;
}

function hitungMenit(waktuStr) {
  if (!waktuStr) return 0;
  let normalized = waktuStr.replace("–", "-").replace(" - ", "-");
  if (!normalized.includes("-")) return 0;

  let parts = normalized.split("-");
  let mParts = parts[0].trim().split(":");
  let sParts = parts[1].trim().split(":");
  if (mParts.length < 2 || sParts.length < 2) return 0;

  let totalMulai = parseInt(mParts[0]) * 60 + parseInt(mParts[1]);
  let totalSelesai = parseInt(sParts[0]) * 60 + parseInt(sParts[1]);

  let selisihMenit = totalSelesai - totalMulai;
  return selisihMenit > 0 ? selisihMenit : 0;
}

function formatTotalWaktu(totalMenit) {
  if (totalMenit <= 0) return "-";
  let jam = Math.floor(totalMenit / 60);
  let menit = totalMenit % 60;
  if (jam > 0 && menit === 0) return `${jam} jam`;
  if (jam > 0 && menit > 0) return `${jam} jam ${menit} menit`;
  return `${menit} menit`;
}

function buatDanUnduhWord(dataKegiatan) {
  // dataKegiatan berasal dari dataGlobalKegiatan yang sudah terurut
  // (tanggal, lalu jam mulai), sehingga pengelompokan per tanggal
  // di bawah otomatis kronologis.
  let groupedData = {};
  let dateKeys = [];

  dataKegiatan.forEach((item) => {
    let dateKey = ambilTanggalKey(item);

    if (!groupedData[dateKey]) {
      groupedData[dateKey] = [];
      dateKeys.push(dateKey);
    }
    groupedData[dateKey].push(item);
  });

  let tableHTML = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="utf-8">
      <title>Logbook Kegiatan</title>
      <style>
        table { border-collapse: collapse; width: 100%; font-family: 'Times New Roman', Times, serif; }
        th, td { border: 1pt solid black; padding: 8px; vertical-align: middle; }
        th { text-align: center; font-weight: bold; }
      </style>
    </head>
    <body>
    <h2 style="text-align:center; font-family: 'Times New Roman', Times, serif;">Logbook Kegiatan Magang</h2>
    <table>
      <thead>
        <tr>
          <th>No.</th>
          <th>Hari, Tanggal</th>
          <th>Waktu</th>
          <th>Aktivitas/Kegiatan</th>
          <th>Jumlah Waktu<br>Kegiatan<br>(menit/jam)</th>
          <th>Dokumentasi<br>Kegiatan</th>
        </tr>
      </thead>
      <tbody>
  `;

  let nomor = 1;
  let totalMenitSemua = 0; // akumulasi seluruh hari untuk baris total

  dateKeys.forEach((dateKey) => {
    let activities = groupedData[dateKey];
    let rowCount = activities.length;
    let totalMenitHari = 0;

    activities.forEach((act) => {
      totalMenitHari += hitungMenit(act.waktu);
    });

    totalMenitSemua += totalMenitHari;

    let durasiHariStr = formatTotalWaktu(totalMenitHari);
    let tanggalStr = formatTanggalWord(dateKey);

    activities.forEach((item, index) => {
      let waktuFormat = (item.waktu || "")
        .replace("–", "-")
        .replace(/:/g, ".")
        .replace("-", " - ");

      let fotoHTML = "-";
      if (item.fotoBase64) {
        // PERBAIKAN 2: Membatasi tinggi maksimum (height="113" setara 30mm)
        // serta memaksa lebar maksimum sel agar Word tidak melar ke samping
        fotoHTML = `<img src="${item.fotoBase64}" alt="Dokumentasi" height="113" style="max-width: 120px; height: auto;">`;
      }

      tableHTML += `<tr>`;
      if (index === 0) {
        tableHTML += `<td rowspan="${rowCount}" style="text-align:center;">${nomor}</td>`;
        tableHTML += `<td rowspan="${rowCount}">${tanggalStr}</td>`;
      }
      tableHTML += `<td style="text-align:center;">${waktuFormat}</td>`;
      tableHTML += `<td>${item.aktivitas}</td>`;
      if (index === 0) {
        tableHTML += `<td rowspan="${rowCount}" style="text-align:center;">${durasiHariStr}</td>`;
      }
      // PERBAIKAN 3: Membatasi lebar kolom tabel dokumentasi agar tidak melebar
      tableHTML += `<td style="text-align:center; padding: 4px; width: 130px;">${fotoHTML}</td>`;
      tableHTML += `</tr>`;
    });
    nomor++;
  });

  // BARIS TOTAL KESELURUHAN (baris paling akhir tabel)
  tableHTML += `<tr>`;
  tableHTML += `<td colspan="4" style="text-align:center; font-weight:bold;">Total Jam Keseluruhan</td>`;
  tableHTML += `<td style="text-align:center; font-weight:bold;">${formatTotalWaktu(totalMenitSemua)}</td>`;
  tableHTML += `<td>&nbsp;</td>`;
  tableHTML += `</tr>`;

  tableHTML += `</tbody></table></body></html>`;

  const blob = new Blob(["\ufeff", tableHTML], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "Logbook_Magang.doc";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Lepas memori setelah unduhan berjalan (lebih ringan di HP)
  setTimeout(function () {
    URL.revokeObjectURL(url);
  }, 1000);
}

// Tombol Download Word: ambil foto dari server HANYA sekarang (daftar di web tanpa foto)
btnDownloadWord.addEventListener("click", function () {
  if (!dataGlobalKegiatan || dataGlobalKegiatan.length === 0) {
    alert("Belum ada data untuk diunduh.");
    return;
  }

  const teksAsli = btnDownloadWord.textContent;
  btnDownloadWord.disabled = true;
  btnDownloadWord.textContent = "Menyiapkan foto...";

  jsonpRequest("action=foto", 60000)
    .then(
      function (hasil) {
        if (!hasil || !hasil.success || !Array.isArray(hasil.data)) return null;
        return hasil.data;
      },
      function () {
        return null;
      },
    )
    .then(function (daftarFoto) {
      btnDownloadWord.disabled = false;
      btnDownloadWord.textContent = teksAsli;

      if (!daftarFoto) {
        if (confirm("Foto gagal diambil dari server. Unduh Word tanpa foto?")) {
          buatDanUnduhWord(dataGlobalKegiatan);
        }
        return;
      }

      const petaFoto = {};
      daftarFoto.forEach(function (f) {
        petaFoto[f.id] = f.fotoBase64;
      });

      // Foto digabung hanya untuk file Word (tidak disimpan di memori halaman)
      const dataWord = dataGlobalKegiatan.map(function (item) {
        return petaFoto[item.id]
          ? Object.assign({}, item, { fotoBase64: petaFoto[item.id] })
          : item;
      });

      buatDanUnduhWord(dataWord);
    });
});

muatKegiatan();

/// ==========================================
// LOGIKA GAMBAR MENGAMBANG (DIBATASI KHUSUS LAPTOP)
// ==========================================
function setGambarRandom() {
  const imgElement = document.getElementById("gambar-random");
  if (!imgElement) return;

  // JIKA DI BUKA DI HP (Lebar layar <= 900px), Hapus elemen gambar dari HTML agar tidak memuat apa pun!
  if (window.innerWidth <= 900) {
    imgElement.remove();
    return;
  }

  // Daftar 10 gambar lokal (hanya berjalan di Laptop/Komputer)
  const daftarGambar = [
    "Gambar1.jpg",
    "Gambar2.jpg",
    "Gambar3.jpg",
    "Gambar4.jpg",
    "Gambar5.jpg",
    "Gambar6.jpg",
    "Gambar7.jpg",
    "Gambar8.jpg",
    "Gambar9.jpg",
    "Gambar10.jpg",
    "Gambar11.jpg",
    "Gambar12.jpg",
    "Gambar13.jpg",
    "Gambar14.jpg",
    "Gambar15.jpg",
    "Gambar16.jpg",
    "Gambar17.jpg",
    "Gambar18.jpg",
    "Gambar19.jpg",
    "Gambar20.jpg",
    "Gambar21.jpg",
    "Gambar22.jpg",
    "Gambar23.jpg",
    "Gambar24.jpg",
    "Gambar25.jpg",
    "Gambar26.jpg",
    "Gambar27.jpg",
    "Gambar28.jpg",
    "Gambar29.jpg",
    "Gambar30.jpg"
  ];

  const indeksGambar = Math.floor(Math.random() * daftarGambar.length);
  imgElement.src = daftarGambar[indeksGambar];

  function pindahKePosisiAcak() {
    const randomTop = Math.floor(Math.random() * 400) + 80;
    const randomSide = Math.random();

    imgElement.style.top = randomTop + "px";
    
    if (randomSide < 0.5) {
      imgElement.style.left = (Math.floor(Math.random() * 150) + 20) + "px";
      imgElement.style.right = "auto";
    } else {
      imgElement.style.right = (Math.floor(Math.random() * 150) + 20) + "px";
      imgElement.style.left = "auto";
    }
  }

  pindahKePosisiAcak();

  imgElement.onmouseenter = function () {
    pindahKePosisiAcak();
  };
}

setGambarRandom();
