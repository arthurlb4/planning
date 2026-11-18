using System.Runtime.InteropServices;

namespace LecteurNatif;

/* Appels Windows utilisés par la fenêtre : DirectComposition (la page est dessinée dans une couche posée au-dessus de la
   vidéo, dans la même fenêtre), souris, fenêtre sans bord mais redimensionnable. */
static class Natif
{
    [ComImport, Guid("C37EA93A-E7AA-450D-B16F-9746CB0407F3"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    public interface IDCompositionDevice
    {
        void Commit();
        void WaitForCommitCompletion();
        void GetFrameStatistics(IntPtr statistics);
        void CreateTargetForHwnd(IntPtr hwnd, [MarshalAs(UnmanagedType.Bool)] bool topmost, out IDCompositionTarget target);
        void CreateVisual(out IDCompositionVisual visual);
    }
    [ComImport, Guid("eacdd04c-117e-4e17-88f4-d1b12b0e3d89"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    public interface IDCompositionTarget { void SetRoot(IDCompositionVisual visual); }
    [ComImport, Guid("4d93059d-097b-4651-9a60-f0f25116e2f3"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    public interface IDCompositionVisual { }

    [DllImport("dcomp.dll")] public static extern int DCompositionCreateDevice2(IntPtr renderingDevice, ref Guid iid, out IntPtr device);

    public static IDCompositionDevice CreateDevice()
    {
        var iid = typeof(IDCompositionDevice).GUID;
        int hr = DCompositionCreateDevice2(IntPtr.Zero, ref iid, out IntPtr p);
        if (hr < 0) Marshal.ThrowExceptionForHR(hr);
        var d = (IDCompositionDevice)Marshal.GetObjectForIUnknown(p);
        Marshal.Release(p);
        return d;
    }

    [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
    [StructLayout(LayoutKind.Sequential)] public struct NCCALCSIZE_PARAMS { public RECT r0, r1, r2; public IntPtr lppos; }
    [StructLayout(LayoutKind.Sequential)] public struct POINT { public int X, Y; }
    [StructLayout(LayoutKind.Sequential)] public struct MINMAXINFO { public POINT reserved, maxSize, maxPosition, minTrackSize, maxTrackSize; }
    [StructLayout(LayoutKind.Sequential)] public struct TRACKMOUSEEVENT { public int cbSize; public uint dwFlags; public IntPtr hwndTrack; public uint dwHoverTime; }
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)] public struct MONITORINFO { public int cbSize; public RECT rcMonitor, rcWork; public uint dwFlags; }

    [DllImport("user32.dll")] public static extern bool TrackMouseEvent(ref TRACKMOUSEEVENT e);
    [DllImport("user32.dll")] public static extern IntPtr SetCapture(IntPtr h);
    [DllImport("user32.dll")] public static extern bool ReleaseCapture();
    [DllImport("user32.dll")] public static extern IntPtr SetFocus(IntPtr h);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern IntPtr FindWindowEx(IntPtr parent, IntPtr after, string? cls, string? title);
    [DllImport("user32.dll")] public static extern IntPtr GetCapture();
    [DllImport("user32.dll")] public static extern bool ScreenToClient(IntPtr h, ref POINT p);
    [DllImport("user32.dll")] public static extern IntPtr SetCursor(IntPtr c);
    [DllImport("user32.dll")] public static extern IntPtr LoadCursor(IntPtr inst, int id);
    [DllImport("user32.dll")] public static extern int GetSystemMetricsForDpi(int index, uint dpi);
    [DllImport("user32.dll")] public static extern uint GetDpiForWindow(IntPtr h);
    [DllImport("user32.dll")] public static extern bool IsZoomed(IntPtr h);
    [DllImport("user32.dll")] public static extern IntPtr MonitorFromWindow(IntPtr h, uint flags);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern bool GetMonitorInfo(IntPtr m, ref MONITORINFO mi);
    [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr after, int x, int y, int cx, int cy, uint flags);
    [DllImport("user32.dll")] public static extern bool EnableWindow(IntPtr h, bool enable);
    public delegate bool EnumProc(IntPtr h, IntPtr l);
    [DllImport("user32.dll")] public static extern bool EnumChildWindows(IntPtr parent, EnumProc f, IntPtr l);
    [DllImport("user32.dll")] public static extern bool IsWindowEnabled(IntPtr h);
    [DllImport("user32.dll")] public static extern IntPtr GetParent(IntPtr h);
    [DllImport("dwmapi.dll")] public static extern int DwmExtendFrameIntoClientArea(IntPtr h, ref MARGINS m);
    [StructLayout(LayoutKind.Sequential)] public struct MARGINS { public int l, r, t, b; }

    public const int WM_NCCALCSIZE = 0x83, WM_NCHITTEST = 0x84, WM_GETMINMAXINFO = 0x24, WM_SETCURSOR = 0x20, WM_MOUSELEAVE = 0x2A3;
    public const int WM_MOUSEFIRST = 0x200, WM_MOUSELAST = 0x20E, WM_MOUSEWHEEL = 0x20A, WM_MOUSEHWHEEL = 0x20E;
    public const int WM_NCRBUTTONDOWN = 0xA4, WM_NCRBUTTONUP = 0xA5;
    public const int HTCLIENT = 1, HTCAPTION = 2, HTLEFT = 10, HTRIGHT = 11, HTTOP = 12, HTTOPLEFT = 13, HTTOPRIGHT = 14, HTBOTTOM = 15, HTBOTTOMLEFT = 16, HTBOTTOMRIGHT = 17;
    public const int SM_CXSIZEFRAME = 32, SM_CYSIZEFRAME = 33, SM_CXPADDEDBORDER = 92;
}
