// app/in/home/page.tsx
import SyncGuard from "@/components/SyncGaurd";


export default async function HomePage() {


  return (
    <SyncGuard>
       {/* in/home */}
       <div className="dashboard">
          <h1>Welcome Back</h1>
          {/* ... */}
       </div>
    </SyncGuard>
  );
}