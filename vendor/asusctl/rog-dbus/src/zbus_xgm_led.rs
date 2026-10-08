//! # D-Bus interface proxy for: `xyz.ljones.XgmLed`
//!
//! This type implements the [D-Bus standard interfaces],
//! (`org.freedesktop.DBus.*`) for which the following zbus API can be used:
//!
//! * [`zbus::fdo::PeerProxy`]
//! * [`zbus::fdo::PropertiesProxy`]
//! * [`zbus::fdo::IntrospectableProxy`]
//!
//! [D-Bus standard interfaces]: https://dbus.freedesktop.org/doc/dbus-specification.html#standard-interfaces,
use zbus::proxy;
#[proxy(
    interface = "xyz.ljones.XgmLed",
    default_service = "xyz.ljones.Asusd",
    default_path = "/xyz/ljones"
)]
pub trait XgmLed {
    /// XgmLedEnabled property
    #[zbus(property)]
    fn xgm_led_enabled(&self) -> zbus::Result<bool>;
    #[zbus(property)]
    fn set_xgm_led_enabled(&self, value: bool) -> zbus::Result<()>;
}
