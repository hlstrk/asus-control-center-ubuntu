use std::cell::RefCell;
use std::sync::{Arc, Mutex, OnceLock, Weak};

use log::error;
use slint::ComponentHandle;
use slint::winit_030::WinitWindowAccessor;

use crate::MainWindow;
use crate::config::Config;
use crate::shortcuts::ShortcutHandle;
use crate::ui::setup_window;
use crate::zbus_proxies::AppState;

thread_local! {
    static WINDOW: RefCell<WindowState> = const {
        RefCell::new(WindowState {
            ui: None,
            quitting: false,
        })
    };
}

#[derive(Debug, Clone, Copy)]
pub enum WindowCommand {
    Show,
    Toggle,
    Quit,
}

#[derive(Clone)]
pub struct WindowController(Arc<Inner>);

#[derive(Clone)]
pub(crate) struct WeakWindowController(Weak<Inner>);

struct Inner {
    config: Arc<Mutex<Config>>,
    prefetched_supported: Arc<Option<Vec<i32>>>,
    app_state: Arc<Mutex<AppState>>,
    is_tuf: bool,
    shortcuts: OnceLock<ShortcutHandle>,
}

struct WindowState {
    ui: Option<MainWindow>,
    quitting: bool,
}

impl WindowController {
    pub fn new(
        config: Arc<Mutex<Config>>,
        prefetched_supported: Arc<Option<Vec<i32>>>,
        app_state: Arc<Mutex<AppState>>,
        is_tuf: bool,
    ) -> Self {
        Self(Arc::new(Inner {
            config,
            prefetched_supported,
            app_state,
            is_tuf,
            shortcuts: OnceLock::new(),
        }))
    }

    /// Injects the shortcut service handle once. Must be called before the
    /// window is first shown, or the settings page is built without it.
    pub fn set_shortcuts(&self, shortcuts: ShortcutHandle) {
        if self.0.shortcuts.set(shortcuts).is_err() {
            error!("Shortcut handle already set");
        }
    }

    pub(crate) fn downgrade(&self) -> WeakWindowController {
        WeakWindowController(Arc::downgrade(&self.0))
    }

    pub fn request(&self, command: WindowCommand) {
        let controller = self.clone();
        if let Err(err) = slint::invoke_from_event_loop(move || controller.handle(command)) {
            error!("Failed to queue {command:?}: {err}");
        }
    }

    fn handle(&self, command: WindowCommand) {
        WINDOW.with_borrow_mut(|state| {
            if state.quitting {
                return;
            }

            match command {
                WindowCommand::Show => self.show(state),
                WindowCommand::Toggle => {
                    if state.ui.as_ref().is_some_and(|ui| ui.window().is_visible()) {
                        self.hide(state);
                    } else {
                        self.show(state);
                    }
                }
                WindowCommand::Quit => match slint::quit_event_loop() {
                    Ok(()) => state.quitting = true,
                    Err(err) => error!("Failed to quit event loop: {err}"),
                },
            }
        });
    }

    fn show(&self, state: &mut WindowState) {
        if state.ui.is_none() {
            let ui = setup_window(
                self.0.config.clone(),
                self.0.prefetched_supported.clone(),
                self.0.app_state.clone(),
                self.0.is_tuf,
                self.0.shortcuts.get().cloned(),
            );
            let app_state = self.0.app_state.clone();
            ui.window().on_close_requested(move || {
                set_app_state(&app_state, AppState::MainWindowClosed);
                slint::CloseRequestResponse::HideWindow
            });

            let config = self.0.config.clone();
            let weak = ui.as_weak();
            ui.window()
                .set_rendering_notifier(move |rendering_state, _| {
                    if let slint::RenderingState::RenderingSetup = rendering_state {
                        let config = config.clone();
                        weak.upgrade_in_event_loop(move |ui| {
                            let fullscreen = config.lock().is_ok_and(|c| c.start_fullscreen);
                            if fullscreen && !ui.window().is_fullscreen() {
                                ui.window().set_fullscreen(true);
                            }
                        })
                        .ok();
                    }
                })
                .ok();
            state.ui = Some(ui);
            set_app_state(&self.0.app_state, AppState::MainWindowOpen);
            return;
        }

        let Some(ui) = state.ui.as_ref() else {
            return;
        };
        ui.window().with_winit_window(|window| {
            window.set_minimized(false);
            window.focus_window();
        });
        center_window(ui);
        match ui.window().show() {
            Ok(()) => set_app_state(&self.0.app_state, AppState::MainWindowOpen),
            Err(err) => error!("Failed to show window: {err}"),
        }
    }

    fn hide(&self, state: &WindowState) {
        let Some(ui) = state.ui.as_ref() else {
            return;
        };
        match ui.window().hide() {
            Ok(()) => set_app_state(&self.0.app_state, AppState::MainWindowClosed),
            Err(err) => error!("Failed to hide window: {err}"),
        }
    }
}

impl WeakWindowController {
    pub(crate) fn upgrade(&self) -> Option<WindowController> {
        self.0.upgrade().map(WindowController)
    }
}

fn set_app_state(app_state: &Mutex<AppState>, state: AppState) {
    match app_state.lock() {
        Ok(mut current) => *current = state,
        Err(err) => error!("Failed to update application state: {err}"),
    }
}

/// Center on the active monitor, including monitors with a nonzero origin.
pub(crate) fn center_window(ui: &MainWindow) {
    ui.window().with_winit_window(|window| {
        if window.is_maximized() || window.fullscreen().is_some() { return; }
        if let Some(monitor) = window.current_monitor().or_else(|| window.primary_monitor()) {
            let origin = monitor.position();
            let screen = monitor.size();
            let size = window.outer_size();
            let x = origin.x + (screen.width.saturating_sub(size.width) / 2) as i32;
            let y = origin.y + (screen.height.saturating_sub(size.height) / 2) as i32;
            window.set_outer_position(slint::winit_030::winit::dpi::PhysicalPosition::new(x, y));
        }
    });
}
