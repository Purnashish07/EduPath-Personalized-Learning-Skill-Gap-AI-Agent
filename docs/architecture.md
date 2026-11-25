# EduPath Architecture

EduPath is a full-stack React/Vite + Express/TypeScript application. The backend owns AI credentials and document processing. A stateful PostgreSQL/Supabase integration is prepared through `DATABASE_URL`; demo mode uses an in-process store so judges can run the product without external infrastructure.

## Agent loop
Profile Analyzer → Role Analyzer → Skill Gap Analyzer → Learning Planner → Resource/Practice/Project Generators → Progress Evaluator → Struggle Detector → Adaptive Planner.

The current API implements the loop through profile, document analysis, skill-gap generation, path/weekly plan generation, task completion, practice attempts, progress, reports and context-aware chat. When `LLM_API_KEY` is set, the same flows call the configured OpenAI-compatible endpoint and validate the returned JSON by parsing it before use. Without a key, deterministic demo data keeps every major flow usable.
