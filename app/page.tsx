import Image from "next/image";
import Link from "next/link";
export default function Home() {
  return (
    <div >
      {/* top naviagation for join and signup */}
      <div className="min-h-12 bg-[#222222] flex"> 
          <nav className="w-full px-6 py-4 bg-[#222222] text-white">
            <div className="flex items-center justify-end">

              <ul className="flex gap-6">
                <li><Link className="hover:text-blue-400 border m-2 px-2 py-1" href="/in/home">Join</Link></li>
                <li><a className="hover:text-blue-400" href="/about">Learn</a></li>
              </ul>
            </div>
          </nav>
      </div>

      {/* Timer */}
      <div className="h-screen bg-[#4A70A9]">
        Timer area
      </div>
    </div>
  );
}
