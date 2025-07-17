const Listing = require("../models/listing");
const mbxGeocoding = require("@mapbox/mapbox-sdk/services/geocoding");
const mapToken = process.env.MAP_TOKEN;
const geoCodingClient = mbxGeocoding({ accessToken: mapToken });

module.exports.index = async (req, res) => {
  let allListings = await Listing.find();
  res.render("./listings/index.ejs", { allListings });
};

module.exports.renderNewForm = (req, res) => {
  res.render("listings/new.ejs");
};

module.exports.showListing = async (req, res) => {
  let { id } = req.params;
  let listing = await Listing.findById(id)
    .populate({ path: "reviews", populate: { path: "author" } })
    .populate("owner");
  if (!listing) {
    req.flash("error", "Listing you requested for does not exist!");
    return res.redirect("/listings");
  }
  res.render("listings/show.ejs", { listing });
};

module.exports.createListing = async (req, res, next) => {
  let geometry;

  try {
    let response = await geoCodingClient
      .forwardGeocode({
        query: req.body.listing.location,
        limit: 1,
      })
      .send();

    if (response.body.features.length) {
      geometry = response.body.features[0].geometry;
    } else {
      console.log("⚠️ No geocoding result, using default coordinates");
      geometry = {
        type: "Point",
        coordinates: [77.2090, 28.6139], // Default: Delhi, India
      };
    }
  } catch (err) {
    console.error("❌ Mapbox error:", err.message);
    geometry = {
      type: "Point",
      coordinates: [77.2090, 28.6139], // Default: Delhi, India
    };
  }

  const newListing = new Listing(req.body.listing);
  newListing.owner = req.user._id;
  newListing.image = { filename: req.file.filename, url: req.file.path };
  newListing.geometry = geometry;

  await newListing.save();
  req.flash("success", "New listing created!");
  res.redirect("/listings");
};

module.exports.renderEditForm = async (req, res) => {
  let { id } = req.params;
  let listing = await Listing.findById(id);
  if (!listing) {
    req.flash("error", "Listing you are trying to edit does not exist!");
    return res.redirect("/listings");
  }
  let imageUrl = listing.image.url;
  imageUrl = imageUrl.replace("/upload", "/upload/w_250,h_160");
  res.render("listings/edit.ejs", { listing, imageUrl });
};

module.exports.updateListing = async (req, res, next) => {
  let { id } = req.params;
  let geometry;

  try {
    let response = await geoCodingClient
      .forwardGeocode({
        query: `${req.body.listing.location},${req.body.listing.country}`,
        limit: 1,
      })
      .send();

    if (response.body.features.length) {
      geometry = response.body.features[0].geometry;
    } else {
      console.log("⚠️ No geocoding result, using default coordinates");
      geometry = {
        type: "Point",
        coordinates: [77.2090, 28.6139], // Default: Delhi, India
      };
    }
  } catch (err) {
    console.error("❌ Mapbox error:", err.message);
    geometry = {
      type: "Point",
      coordinates: [77.2090, 28.6139], // Default: Delhi, India
    };
  }

  req.body.listing.geometry = geometry;

  let updatedListing = await Listing.findByIdAndUpdate(id, {
    ...req.body.listing,
  });

  if (typeof req.file !== "undefined") {
    let url = req.file.path;
    let filename = req.file.filename;
    updatedListing.image = { url, filename };
    await updatedListing.save();
  }

  req.flash("success", "Listing updated!");
  res.redirect(`/listings/${id}`);
};

module.exports.filter = async (req, res, next) => {
  let { id } = req.params;
  let allListings = await Listing.find({ category: { $all: [id] } });
  if (allListings.length !== 0) {
    res.locals.success = `Listings filtered by ${id}!`;
    res.render("listings/index.ejs", { allListings });
  } else {
    req.flash("error", `There are no listings for ${id}!`);
    res.redirect("/listings");
  }
};

module.exports.search = async (req, res) => {
  let input = req.query.q.trim().replace(/\s+/g, " ");
  if (input === "" || input === " ") {
    req.flash("error", "Please enter a search query!");
    return res.redirect("/listings");
  }

  let element = input
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");

  let allListings = await Listing.find({
    title: { $regex: element, $options: "i" },
  });

  if (allListings.length) {
    res.locals.success = "Listings searched by Title!";
    return res.render("listings/index.ejs", { allListings });
  }

  allListings = await Listing.find({
    category: { $regex: element, $options: "i" },
  }).sort({ _id: -1 });
  if (allListings.length) {
    res.locals.success = "Listings searched by Category!";
    return res.render("listings/index.ejs", { allListings });
  }

  allListings = await Listing.find({
    country: { $regex: element, $options: "i" },
  }).sort({ _id: -1 });
  if (allListings.length) {
    res.locals.success = "Listings searched by Country!";
    return res.render("listings/index.ejs", { allListings });
  }

  allListings = await Listing.find({
    location: { $regex: element, $options: "i" },
  }).sort({ _id: -1 });
  if (allListings.length) {
    res.locals.success = "Listings searched by Location!";
    return res.render("listings/index.ejs", { allListings });
  }

  const intValue = parseInt(element, 10);
  if (!isNaN(intValue)) {
    allListings = await Listing.find({ price: { $lte: intValue } }).sort({
      price: 1,
    });
    if (allListings.length) {
      res.locals.success = `Listings searched by price less than Rs ${element}!`;
      return res.render("listings/index.ejs", { allListings });
    }
  }

  req.flash("error", "No listings found based on your search!");
  res.redirect("/listings");
};

module.exports.destroyListing = async (req, res) => {
  let { id } = req.params;
  await Listing.findByIdAndDelete(id);
  req.flash("success", "Listing deleted!");
  res.redirect("/listings");
};

module.exports.reserveListing = async (req, res) => {
  let { id } = req.params;
  req.flash("success", "Reservation details sent to your email!");
  res.redirect(`/listings/${id}`);
};
