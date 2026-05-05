import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Subject = {
  id: string;
  name: string;
  description: string | null;
  created_by_name: string;
  created_at: string;
  question_count?: number;
  solved_count?: number;
};

export type Question = {
  id: string;
  subject_id: string;
  title: string;
  description: string | null;
  status: 'unsolved' | 'in_progress' | 'solved';
  uploaded_by_name: string;
  created_at: string;
  updated_at: string;
  images?: QuestionImage[];
  solution?: Solution;
};

export type QuestionImage = {
  id: string;
  question_id: string;
  storage_path: string;
  page_order: number;
  created_at: string;
};

export type Solution = {
  id: string;
  question_id: string;
  text_content: string | null;
  created_by_name: string;
  updated_by_name: string | null;
  created_at: string;
  updated_at: string;
  images?: SolutionImage[];
};

export type SolutionImage = {
  id: string;
  solution_id: string;
  storage_path: string;
  page_order: number;
  created_at: string;
};
