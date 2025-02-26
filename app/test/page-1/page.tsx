import Link from "next/link";

export default function Page1() {
  return <>
    <div>
      Page 1
    </div>
    <Link href="/test/page-2">Goto Page 2</Link>
  </>;
}
