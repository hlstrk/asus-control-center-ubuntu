use argh::FromArgs;
use rog_scsi::{AuraMode, Colour, Direction, Speed};

#[derive(FromArgs, Debug)]
#[argh(subcommand, name = "scsi", description = "scsi LED commands")]
pub struct ScsiCommand {
    #[argh(option, description = "enable the SCSI drive LEDs")]
    pub enable: Option<bool>,

    #[argh(option, description = "set LED mode (use 'list' for all options)")]
    pub mode: Option<AuraMode>,

    #[argh(
        option,
        description = "set LED mode speed <slowest, slow, med, fast, fastest>"
    )]
    pub speed: Option<Speed>,

    #[argh(option, description = "set LED mode direction <forward, reverse>")]
    pub direction: Option<Direction>,

    #[argh(
        option,
        description = "set LED colours <hex>, specify up to 4 with repeated arg"
    )]
    pub colours: Vec<Colour>,

    #[argh(switch, description = "list available animations")]
    pub list: bool,
}
