import type { ResumeMimeType } from "@/lib/resume/constants";

export interface ResumeProps {
  id: string;
  user_id: string;
  file_path: string;
  file_name: string;
  mime_type: string;
  size: number;
  created_at: string;
}

export class Resume {
  readonly id: string;
  readonly userId: string;
  readonly filePath: string;
  readonly fileName: string;
  readonly mimeType: ResumeMimeType;
  readonly size: number;
  readonly createdAt: string;

  constructor(props: ResumeProps) {
    this.id = props.id;
    this.userId = props.user_id;
    this.filePath = props.file_path;
    this.fileName = props.file_name;
    this.mimeType = props.mime_type as ResumeMimeType;
    this.size = props.size;
    this.createdAt = props.created_at;
  }
}
