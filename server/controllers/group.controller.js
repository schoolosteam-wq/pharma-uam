const db = require("../models");
const Group = db.Group;
const User = db.User;
const { auditHelper } = require("../utils/auditHelper");

exports.create = async (req, res) => {
  try {
    const group = await Group.create(req.body);
    await auditHelper("GROUP", group.id, "CREATED", null, {
      "Group Name": group.groupName,
      Description: group.description || ''
    }, req.userId, req.ip, "Group created");
    res.status(201).send(group);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

exports.findAll = async (req, res) => {
  try {
    const groups = await Group.findAll();
    res.send(groups);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

exports.findOne = async (req, res) => {
  try {
    const group = await Group.findByPk(req.params.id);
    if (!group) return res.status(404).send({ message: "Not found" });
    res.send(group);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

exports.getMembers = async (req, res) => {
  try {
    const group = await Group.findByPk(req.params.id, {
      include: [{ model: User, as: "users", attributes: ["id", "fullName", "username", "email"] }]
    });
    if (!group) return res.status(404).send({ message: "Group not found" });
    res.send(group.users);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

exports.updateMembers = async (req, res) => {
  try {
    const group = await Group.findByPk(req.params.id);
    if (!group) return res.status(404).send({ message: "Group not found" });

    const oldUsers = await group.getUsers({ attributes: ["id", "username"] });
    const oldUsernames = oldUsers.map(u => u.username);

    const { userIds } = req.body;
    const newUsers = await User.findAll({ where: { id: userIds } });
    await group.setUsers(newUsers);

    const newUsernames = newUsers.map(u => u.username);

    const added = newUsernames.filter(u => !oldUsernames.includes(u));
    const removed = oldUsernames.filter(u => !newUsernames.includes(u));

    await auditHelper("GROUP", group.id, "MEMBERS_UPDATED",
      { "Group Name": group.groupName, Added: [], Removed: [] },
      { "Group Name": group.groupName, Added: added, Removed: removed },
      req.userId, req.ip, "Group members updated"
    );

    res.send({ message: "Members updated" });
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

exports.update = async (req, res) => {
  try {
    const group = await Group.findByPk(req.params.id);
    if (!group) return res.status(404).send({ message: "Not found" });
    const oldVal = { ...group.toJSON() };
    await group.update(req.body);
    await auditHelper("GROUP", group.id, "UPDATED", oldVal, group.toJSON(), req.userId, req.ip);
    res.send(group);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

exports.delete = async (req, res) => {
  try {
    const group = await Group.findByPk(req.params.id, {
      include: [{ model: User, as: "users", attributes: ["id", "username", "fullName"] }]
    });
    if (!group) return res.status(404).send({ message: "Not found" });

    const oldValue = {
      "Group Name": group.groupName,
      Description: group.description || '',
      Members: group.users.map(u => u.fullName || u.username)
    };

    await group.destroy();
    await auditHelper("GROUP", req.params.id, "DELETED", oldValue, null, req.userId, req.ip, "Group deleted");
    res.send({ message: "Deleted" });
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};