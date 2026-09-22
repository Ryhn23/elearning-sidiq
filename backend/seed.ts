/// <reference types="node" />
import { db } from './src/db';
import {
  users, categories, courses, courseSections, lessons, lessonContents, enrollments,
} from './src/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

async function seed() {
  const salt = await bcrypt.genSalt(10);
  const hash = (pw: string) => bcrypt.hash(pw, salt);

  // ============================================================
  // USERS
  // ============================================================
  const [admin] = await db.insert(users).values({
    name: 'Admin Utama',
    email: 'admin@elearning.com',
    passwordHash: await hash('password123'),
    role: 'admin',
    bio: 'Administrator platform e-learning.',
  }).onConflictDoNothing().returning();

  const teacherEmail = 'teacher@elearning.com';
  let [teacher] = await db.select().from(users).where(eq(users.email, teacherEmail)).limit(1);
  if (!teacher) {
    [teacher] = await db.insert(users).values({
      name: 'Dr. Andi Wijaya',
      email: teacherEmail,
      passwordHash: await hash('password123'),
      role: 'teacher',
      bio: 'Pengajar berpengalaman di bidang pemrograman dan data science.',
    }).returning();
  }

  const studentData = [
    { name: 'Budi Santoso', email: 'budi@student.com' },
    { name: 'Siti Rahayu', email: 'siti@student.com' },
    { name: 'Dewi Lestari', email: 'dewi@student.com' },
    { name: 'Eko Prasetyo', email: 'eko@student.com' },
    { name: 'Fitri Handayani', email: 'fitri@student.com' },
  ];

  const students: any[] = [];
  for (const s of studentData) {
    let [row] = await db.select().from(users).where(eq(users.email, s.email)).limit(1);
    if (!row) {
      [row] = await db.insert(users).values({
        name: s.name,
        email: s.email,
        passwordHash: await hash('password123'),
        role: 'student',
      }).returning();
    }
    students.push(row);
  }

  // ============================================================
  // CATEGORIES
  // ============================================================
  const categoryData = [
    { name: 'Pemrograman', slug: 'pemrograman', description: 'Kursus programming: web, mobile, backend', sortOrder: 1 },
    { name: 'Desain', slug: 'desain', description: 'UI/UX, graphic design, dan creative', sortOrder: 2 },
    { name: 'Data Science', slug: 'data-science', description: 'Analisis data, machine learning, statistik', sortOrder: 3 },
    { name: 'Marketing', slug: 'marketing', description: 'Digital marketing, branding, growth', sortOrder: 4 },
    { name: 'Bisnis', slug: 'bisnis', description: 'Manajemen bisnis, keuangan, kewirausahaan', sortOrder: 5 },
  ];

  const catMap = new Map<string, any>();
  for (const c of categoryData) {
    let [row] = await db.select().from(categories).where(eq(categories.slug, c.slug)).limit(1);
    if (!row) {
      [row] = await db.insert(categories).values(c).returning();
    }
    catMap.set(c.slug, row);
  }

  // ============================================================
  // COURSES (3 dummy)
  // ============================================================
  const existingCourses = await db.select().from(courses).limit(1);
  if (existingCourses.length === 0) {
    // --- Course 1: Dasar Pemrograman Web ---
    const [course1] = await db.insert(courses).values({
      slug: 'dasar-pemrograman-web',
      title: 'Dasar Pemrograman Web untuk Pemula',
      description: 'Kursus ini mengajak Anda memahami dasar-dasar pemrograman web: HTML, CSS, dan JavaScript. Anda akan membangun proyek nyata dari nol hingga deploy.',
      shortDescription: 'Pelajari HTML, CSS, dan JavaScript dari nol hingga bisa membuat website sendiri.',
      instructorId: teacher.id,
      categoryId: catMap.get('pemrograman')!.id,
      level: 'beginner',
      status: 'published',
      language: 'id',
      estimatedHours: 20,
      price: 0,
      learningOutcomes: ['Membuat halaman web dengan HTML semantik', 'Menata tampilan dengan CSS dan Flexbox', 'Interaksi pengguna dengan JavaScript dasar', 'Deploy proyek ke hosting'],
      requirements: ['Tidak perlu pengalaman programming', 'Laptop dengan browser modern'],
      tags: ['html', 'css', 'javascript', 'web'],
      certificateEnabled: true,
      totalEnrolled: 3,
      publishedAt: new Date(),
    }).returning();

    const [sec1a] = await db.insert(courseSections).values({
      courseId: course1.id,
      title: 'Pengantar Web & HTML',
      description: 'Memahami cara kerja web dan struktur HTML.',
      sortOrder: 0,
    }).returning();
    const [sec1b] = await db.insert(courseSections).values({
      courseId: course1.id,
      title: 'CSS & Styling',
      description: 'Menata tampilan website dengan CSS.',
      sortOrder: 1,
    }).returning();
    const [sec1c] = await db.insert(courseSections).values({
      courseId: course1.id,
      title: 'JavaScript Dasar',
      description: 'Logika dan interaktivitas dengan JavaScript.',
      sortOrder: 2,
    }).returning();

    const l1a1 = await insertLesson(sec1a.id, 'Apa itu Web?', 'text', 0, true);
    await db.insert(lessonContents).values({
      lessonId: l1a1.id,
      textContent: '<h2>Apa itu Web?</h2><p>World Wide Web (WWW) adalah sistem dokumen yang saling terhubung melalui internet. Setiap website dibangun dari tiga teknologi utama:</p><ul><li><strong>HTML</strong> — struktur konten</li><li><strong>CSS</strong> — tampilan dan gaya</li><li><strong>JavaScript</strong> — logika dan interaktivitas</li></ul><p>Dalam kursus ini kita akan mempelajari ketiganya dari dasar.</p>',
    });

    const l1a2 = await insertLesson(sec1a.id, 'Struktur HTML', 'text', 1, false);
    await db.insert(lessonContents).values({
      lessonId: l1a2.id,
      textContent: '<h2>Struktur HTML</h2><p>HTML menggunakan <em>element</em> yang ditandai dengan tag. Contoh:</p><pre>&lt;h1&gt;Judul&lt;/h1&gt;\n&lt;p&gt;Paragraf&lt;/p&gt;</pre><p>Setiap halaman web memiliki struktur dasar: <code>&lt;head&gt;</code> untuk metadata dan <code>&lt;body&gt;</code> untuk konten yang terlihat.</p>',
    });

    const l1b1 = await insertLesson(sec1b.id, 'CSS Fundamentals', 'text', 0, false);
    await db.insert(lessonContents).values({
      lessonId: l1b1.id,
      textContent: '<h2>CSS Fundamentals</h2><p>CSS (Cascading Style Sheets) digunakan untuk mengatur tampilan elemen HTML. Konsep penting:</p><ul><li>Selector dan property</li><li>Box model: margin, padding, border</li><li>Flexbox dan Grid layout</li></ul>',
    });

    const l1c1 = await insertLesson(sec1c.id, 'Variabel & Fungsi JS', 'text', 0, false);
    await db.insert(lessonContents).values({
      lessonId: l1c1.id,
      textContent: '<h2>Variabel &amp; Fungsi JavaScript</h2><p>JavaScript adalah bahasa pemrograman yang berjalan di browser. Pelajari dasar variabel (<code>let</code>, <code>const</code>) dan fungsi untuk membuat halaman web interaktif.</p>',
    });

    // --- Course 2: Python untuk Data Science ---
    const [course2] = await db.insert(courses).values({
      slug: 'python-untuk-data-science',
      title: 'Python untuk Data Science',
      description: 'Pelajari Python dari dasar hingga bisa menganalisis data menggunakan pandas dan visualisasi dengan matplotlib.',
      shortDescription: 'Dari nol sampai bisa analisis data dengan Python, pandas, dan visualisasi.',
      instructorId: teacher.id,
      categoryId: catMap.get('data-science')!.id,
      level: 'intermediate',
      status: 'published',
      language: 'id',
      estimatedHours: 30,
      price: 150000,
      learningOutcomes: ['Sintaks Python dasar', 'Manipulasi data dengan pandas', 'Visualisasi data dengan matplotlib', 'Membuat laporan analisis sederhana'],
      requirements: ['Dasar-dasar logika programming', 'Python terinstall di laptop'],
      tags: ['python', 'pandas', 'data-analysis'],
      certificateEnabled: true,
      totalEnrolled: 2,
      publishedAt: new Date(),
    }).returning();

    const [sec2a] = await db.insert(courseSections).values({
      courseId: course2.id,
      title: 'Dasar Python',
      sortOrder: 0,
    }).returning();
    const [sec2b] = await db.insert(courseSections).values({
      courseId: course2.id,
      title: 'Pandas & Data Manipulation',
      sortOrder: 1,
    }).returning();

    const l2a1 = await insertLesson(sec2a.id, 'Setup Environment Python', 'text', 0, true);
    await db.insert(lessonContents).values({
      lessonId: l2a1.id,
      textContent: '<h2>Setup Environment Python</h2><p>Pastikan Python versi 3.10+ terinstall. Buat virtual environment:</p><pre>python -m venv .venv\nsource .venv/bin/activate  # macOS/Linux\n.venv\\Scripts\\activate      # Windows</pre>',
    });

    const l2b1 = await insertLesson(sec2b.id, 'DataFrame Pandas', 'text', 0, false);
    await db.insert(lessonContents).values({
      lessonId: l2b1.id,
      textContent: '<h2>DataFrame Pandas</h2><p>DataFrame adalah struktur data utama di pandas — seperti tabel spreadsheet. Pelajari cara membaca CSV, filtering, grouping, dan agregasi.</p>',
    });

    // --- Course 3: Digital Marketing (draft) ---
    const [course3] = await db.insert(courses).values({
      slug: 'digital-marketing-modern',
      title: 'Digital Marketing Modern',
      description: 'Strategi pemasaran digital: SEO, social media, email marketing, dan analytics.',
      shortDescription: 'Kuasai strategi digital marketing untuk bisnis modern.',
      instructorId: teacher.id,
      categoryId: catMap.get('marketing')!.id,
      level: 'all_levels',
      status: 'draft',
      language: 'id',
      estimatedHours: 15,
      price: 0,
      learningOutcomes: ['Memahami funnel pemasaran digital', 'Optimasi SEO dasar', 'Kampanye social media'],
      requirements: [],
      tags: ['marketing', 'seo'],
      certificateEnabled: false,
      totalEnrolled: 0,
    }).returning();

    const [sec3a] = await db.insert(courseSections).values({
      courseId: course3.id,
      title: 'Fundasi Digital Marketing',
      sortOrder: 0,
    }).returning();

    const l3a1 = await insertLesson(sec3a.id, 'Peta Lanskap Digital Marketing', 'text', 0, false);
    await db.insert(lessonContents).values({
      lessonId: l3a1.id,
      textContent: '<h2>Peta Lanskap Digital Marketing</h2><p>Kenali channel-channel pemasaran digital dan cara memilih yang tepat untuk bisnis Anda.</p>',
    });

    // ============================================================
    // ENROLLMENTS (student dummy)
    // ============================================================
    const enrollSeed = [
      { userId: students[0].id, courseId: course1.id },
      { userId: students[1].id, courseId: course1.id },
      { userId: students[2].id, courseId: course1.id },
      { userId: students[3].id, courseId: course2.id },
      { userId: students[4].id, courseId: course2.id },
    ];
    for (const e of enrollSeed) {
      await db.insert(enrollments).values({ userId: e.userId, courseId: e.courseId }).onConflictDoNothing();
    }

    console.log('Seed kursus berhasil!');
  } else {
    console.log('Kursus sudah ada, skip seed kursus.');
  }

  console.log('\n=== Seed selesai ===');
  console.log('Admin:     admin@elearning.com / password123');
  console.log('Teacher:   teacher@elearning.com / password123');
  console.log('Students:  budi@s / siti@s / dewi@s / eko@s / fitri@student.com (password123)');
  process.exit(0);
}

async function insertLesson(sectionId: string, title: string, type: any, sortOrder: number, isFreePreview: boolean) {
  const [row] = await db.insert(lessons).values({
    sectionId,
    title,
    type,
    sortOrder,
    isFreePreview,
    durationMinutes: 10 + sortOrder * 5,
  }).returning();
  return row;
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
