import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rgtfxuurnqahvchmgiuu.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJndGZ4dXVybnFhaHZjaG1naXV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQyMzA4MzAsImV4cCI6MjA3OTgwNjgzMH0.jvW3_j8zyzPAe5drgon5X5c5NfktROyZ2yuY0aLOnds';

export const supabase = createClient(supabaseUrl, supabaseKey);