const customerService = require('../../services/admin/customerService');

const loadUsers = async (req, res) => {
    try {

        const page =
            parseInt(req.query.page) || 1;

        const result =
            await customerService.getUsers(page);

        res.render('admin/userManagement', {
            users: result.users,
            currentPage: page,
            limit: result.limit,
            nextPage: page + 1,
            prevPage: page - 1,
            prevDisable:
                page <= 1 ? "disabled" : "",
            nextDisable:
                page >= result.totalPages
                    ? "disabled"
                    : "",
            search: ""
        });

    } catch (err) {

        console.error(err);

        res.status(500).send(
            "Error loading users"
        );
    }
};

const searchUser = async (req, res) => {
    try {

        const searchName =
            req.body.username
                ? req.body.username.trim()
                : "";

        const users =
            await customerService.searchUsers(
                searchName
            );

        res.render('admin/userManagement', {
            users,
            currentPage: 1,
            limit: 8,
            nextPage: 1,
            prevPage: 1,
            prevDisable: "disabled",
            nextDisable: "disabled",
            search: searchName
        });

    } catch (err) {

        console.error(err);

        res.status(500).send(
            "Search failed"
        );
    }
};

const addUserPage = async (req, res) => {
    res.render('admin/addUser', {
        message: null
    });
};

const addUser = async (req, res) => {
    try {

        const {
            username,
            email,
            password,
            phone
        } = req.body;

        await customerService.createUser(
            username,
            email,
            password,
            phone
        );

        res.redirect(
            '/admin/userManagement'
        );

    } catch (error) {

        res.render('admin/addUser', {
            message: error.message
        });
    }
};

const blockUser = async (req, res) => {
    try {

        await customerService.blockUser(
            req.body.id
        );

        res.status(200).json({
            success: true
        });

    } catch (err) {

        res.status(500).json({
            success: false
        });
    }
};

const unBlockUser = async (req, res) => {
    try {

        await customerService.unBlockUser(
            req.body.id
        );

        res.status(200).json({
            success: true
        });

    } catch (err) {

        res.status(500).json({
            success: false
        });
    }
};

module.exports = {
    loadUsers,
    searchUser,
    addUserPage,
    addUser,
    blockUser,
    unBlockUser
};