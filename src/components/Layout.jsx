import { NavLink, Outlet } from "react-router";
import { Button } from "@chakra-ui/react";
import { MdDashboard, MdChildCare, MdFactCheck, MdPeople, MdSwapHoriz, MdLogout, MdRefresh } from "react-icons/md";
import { useAuth } from "../context/AuthContext";
import { useData } from "../context/DataContext";

const NAV = [
    { to: "/admin", label: "Overview", icon: MdDashboard, end: true },
    { to: "/admin/children", label: "Children", icon: MdChildCare },
    { to: "/admin/followups", label: "Follow-ups", icon: MdFactCheck },
    { to: "/admin/workers", label: "Entry Makers", icon: MdPeople },
    { to: "/admin/reassign", label: "Reassign", icon: MdSwapHoriz },
];

const Layout = () => {
    const { user, profile, signOut } = useAuth();
    const { loading, refresh, loadedAt } = useData();

    return (
        <div className="app-shell">
            <aside className="sidebar">
                <div className="logos">
                    <img src="/logo.jpg" alt="MP Birla" />
                    <img src="/asra.png" alt="Asra" />
                    <div className="brand">
                        Kilkari
                        <small>Admin console</small>
                    </div>
                </div>
                {NAV.map((n) => (
                    <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}>
                        <n.icon size={18} />
                        {n.label}
                    </NavLink>
                ))}
                <div className="spacer" />
                <Button size="sm" variant="ghost" onClick={refresh} loading={loading} justifyContent="flex-start">
                    <MdRefresh /> Refresh data
                </Button>
                {loadedAt && <div className="user">Loaded {loadedAt.toLocaleTimeString()}</div>}
                <div className="user">
                    {profile?.name ? <b>{profile.name}</b> : null}
                    <div>{user?.email}</div>
                </div>
                <Button size="sm" variant="ghost" colorPalette="red" onClick={signOut} justifyContent="flex-start">
                    <MdLogout /> Log out
                </Button>
            </aside>
            <main className="content">
                <Outlet />
            </main>
        </div>
    );
};

export default Layout;
