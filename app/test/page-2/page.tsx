import Link from "next/link";

export default function Page2() {
  return <>
    <div>
      Page 2
    </div>
    <Link href="/test/page-1">Goto Page 1</Link>
  </>;
}
