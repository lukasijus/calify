'use client';
import { useState } from 'react';
import { PhotoProvider } from './photos';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AppBar, Box, Button, CssBaseline, Drawer, List, ListItemButton, ListItemText, Toolbar, Typography, ThemeProvider, createTheme } from '@mui/material';
const theme = createTheme({
  palette: { primary: { main: '#216657' }, background: { default: '#f5f7f6', paper: '#ffffff' }, text: { primary: '#20332e', secondary: '#596c65' } },
  typography: { fontFamily: 'Arial, Helvetica, sans-serif', h1: { fontSize: '2.2rem', fontWeight: 700 }, h2: { fontSize: '1.3rem', fontWeight: 700 }, h3: { fontSize: '1.05rem', fontWeight: 700 }, button: { textTransform: 'none', fontWeight: 600 } },
  shape: { borderRadius: 12 },
  components: { MuiButton: { defaultProps: { disableElevation: true } }, MuiPaper: { defaultProps: { elevation: 0, variant: 'outlined' } } },
});
export default function Shell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const navigation = <Box sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
    <Typography sx={{ fontSize: 27, fontWeight: 800, letterSpacing: '-1px', mb: 0.5 }}>◧ Calify</Typography>
    <Typography variant="caption" color="text.secondary" sx={{ mb: 5 }}>A clearer view of your progress</Typography>
    <List component="nav" aria-label="Primary navigation">
      {[['Main', '/'], ['Calibration', '/calibration']].map(([label, href]) => {
        const selected = href === '/' ? !pathname.endsWith('/calibration') : pathname.endsWith(href);
        return <ListItemButton key={href} component={Link} href={href} selected={selected} aria-current={selected ? 'page' : undefined} onClick={() => setOpen(false)} sx={{ borderRadius: 2, mb: 1, '&.Mui-selected': { bgcolor: '#deeee7', color: '#174d40', fontWeight: 700 } }}><ListItemText primary={label} /></ListItemButton>;
      })}
    </List>
    <Typography variant="caption" color="text.secondary" sx={{ mt: 'auto', pt: 5 }}>Your device. Your data.<br />No account needed.</Typography>
  </Box>;
  return <ThemeProvider theme={theme}><CssBaseline />
    <a className="skip-link" href="#content">Skip to content</a>
    <AppBar position="sticky" color="inherit" sx={{ display: { md: 'none' } }}><Toolbar><Typography sx={{ flexGrow: 1, fontWeight: 800 }}>Calify</Typography><Button aria-label="Open navigation" aria-expanded={open} onClick={() => setOpen(true)}>Menu</Button></Toolbar></AppBar>
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <Drawer variant="permanent" sx={{ display: { xs: 'none', md: 'block' }, width: 248, '& .MuiDrawer-paper': { width: 248 } }}>{navigation}</Drawer>
      <Drawer open={open} onClose={() => setOpen(false)} sx={{ display: { md: 'none' }, '& .MuiDrawer-paper': { width: 268 } }}>{navigation}</Drawer>
      <Box component="main" id="content" sx={{ flex: 1, minWidth: 0, p: { xs: 2, sm: 4, lg: 6 }, maxWidth: 1500, mx: 'auto' }}><PhotoProvider>{children}</PhotoProvider></Box>
    </Box>
  </ThemeProvider>;
}
