import { ArrowLeft, ChevronRight } from "lucide-react";
import { Button } from "../ui";

export default function SearchContext({ title, onReturn }: { title: string; onReturn: () => void }) {
  return <nav className="search-context" aria-label="시험장비 검색 내 현재 위치">
    <div><button type="button" onClick={onReturn}>시험장비 검색</button><ChevronRight size={14} aria-hidden="true" /><span aria-current="page">{title}</span></div>
    <Button variant="secondary" icon={ArrowLeft} onClick={onReturn}>검색 결과로</Button>
  </nav>;
}
