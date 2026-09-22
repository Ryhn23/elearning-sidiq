export type Role = 'student' | 'teacher' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatarUrl?: string | null;
}

export interface CategoryRef {
  id: string;
  name: string;
  slug: string;
}

export interface InstructorRef {
  id: string;
  name: string;
  avatarUrl?: string | null;
  bio?: string | null;
}

/** Item katalog (GET /courses). */
export interface CourseListItem {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  shortDescription: string | null;
  thumbnailUrl: string | null;
  level: 'beginner' | 'intermediate' | 'advanced';
  language: string;
  estimatedHours: number;
  price: number;
  certificateEnabled?: boolean;
  totalEnrolled: number;
  averageRating: number;
  totalReviews: number;
  instructor: InstructorRef;
  category: CategoryRef | null;
}

export interface LessonMeta {
  id: string;
  sectionId: string;
  title: string;
  type: 'video' | 'text' | 'document' | 'quiz' | 'zoom' | 'assignment';
  sortOrder: number;
  isVisible: boolean;
  isFreePreview: boolean;
  durationMinutes: number;
}

export interface SectionMeta {
  id: string;
  courseId: string;
  title: string;
  description: string | null;
  sortOrder: number;
  isVisible: boolean;
  lessons: LessonMeta[];
}

export interface ReviewItem {
  id: string;
  rating: number;
  review: string | null;
  createdAt: string;
  author: {
    id: string;
    name: string;
    avatarUrl?: string | null;
  };
}

/** Detail kursus (GET /courses/:slug) — menyertakan kolom course mentah. */
export interface CourseDetailData extends CourseListItem {
  instructorId: string;
  requirements: string[];
  learningOutcomes: string[];
  tags: string[];
  sections: SectionMeta[];
  reviews?: ReviewItem[];
  ratingDistribution?: Record<number, number>;
}

export interface LessonContent {
  videoUrl: string | null;
  documentUrl: string | null;
  documentName: string | null;
  textContent: string | null;
  zoomUrl: string | null;
  assignmentInstructions: string | null;
}

export interface EnrollmentItem {
  id: string;
  courseId: string;
  status: 'active' | 'completed';
  progress: number;
  enrolledAt: string;
  course: {
    id: string;
    slug: string;
    title: string;
    thumbnailUrl: string | null;
    shortDescription: string | null;
  };
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
