import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET() {
  // Next.js dev 환경에서 cwd는 frontend/ 디렉토리
  // 프로젝트 루트는 상위 디렉토리
  const filePath = path.join(process.cwd(), "..", "DB GAPS 투자대회 핵심 규칙 및 평가요소.md");

  try {
    let content = fs.readFileSync(filePath, "utf-8");

    // YAML frontmatter 제거
    content = content.replace(/^---[\s\S]*?---\n*/u, "");

    // Obsidian 전용 문법 처리
    // ![[파일명]] — 이미지/파일 임베드 제거
    content = content.replace(/!\[\[([^\]]*)\]\]/gu, "");
    // [[링크]] — 내부 링크를 일반 텍스트로 변환
    content = content.replace(/\[\[([^\]]*)\]\]/gu, "$1");

    return NextResponse.json({ content });
  } catch {
    return NextResponse.json(
      { error: "규칙 파일을 불러올 수 없습니다." },
      { status: 500 }
    );
  }
}
