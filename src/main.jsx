import { createRoot } from "react-dom/client";
import "./index.css";
import "react-toastify/dist/ReactToastify.css";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { ChakraProvider } from "@chakra-ui/react";
import { ToastContainer } from "react-toastify";
import { system } from "./theme";
import { AuthProvider } from "./context/AuthContext";
import { DataProvider } from "./context/DataContext";
import ProtectedRoute, { AdminRoute } from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Overview from "./pages/Overview";
import Children from "./pages/Children";
import Followups from "./pages/Followups";
import Workers from "./pages/Workers";
import Reassign from "./pages/Reassign";

createRoot(document.getElementById("root")).render(
    <ChakraProvider value={system}>
        <AuthProvider>
            <DataProvider>
                <BrowserRouter>
                    <Routes>
                        <Route path="/" element={<Login />} />
                        <Route
                            path="/admin"
                            element={
                                <ProtectedRoute>
                                    <Layout />
                                </ProtectedRoute>
                            }
                        >
                            <Route index element={<Overview />} />
                            <Route path="children" element={<Children />} />
                            <Route path="followups" element={<Followups />} />
                            <Route path="workers" element={<AdminRoute><Workers /></AdminRoute>} />
                            <Route path="reassign" element={<AdminRoute><Reassign /></AdminRoute>} />
                        </Route>
                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                </BrowserRouter>
                <ToastContainer position="bottom-right" />
            </DataProvider>
        </AuthProvider>
    </ChakraProvider>
);
